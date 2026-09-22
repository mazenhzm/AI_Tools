import { describe, expect, it } from "vitest";
import {
  createHttpGet,
  parseRetryAfter,
  retryDelayMs,
} from "@/ingestion/adapters/http";
import { NetworkError, TimeoutError } from "@/ingestion/errors";

function fakeResponse(status: number, headers: Record<string, string> = {}, body = "{}") {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: async () => body,
  } as unknown as Response;
}

describe("parseRetryAfter", () => {
  it("parses whole seconds", () => {
    expect(parseRetryAfter("5")).toBe(5);
    expect(parseRetryAfter(" 0 ")).toBe(0);
  });

  it("parses an absolute HTTP date", () => {
    const future = new Date(Date.now() + 4000).toUTCString();
    const secs = parseRetryAfter(future);
    expect(secs).not.toBeNull();
    expect(secs!).toBeGreaterThanOrEqual(3);
    expect(secs!).toBeLessThanOrEqual(5);
  });

  it("returns null for absent or invalid values", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter("not-a-date")).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
  });
});

describe("retryDelayMs", () => {
  it("prefers the server-provided Retry-After", () => {
    expect(retryDelayMs(0, 2)).toBe(2000);
  });

  it("applies capped exponential backoff otherwise", () => {
    expect(retryDelayMs(0, null, 1000, 8000)).toBe(1000);
    expect(retryDelayMs(1, null, 1000, 8000)).toBe(2000);
    expect(retryDelayMs(2, null, 1000, 8000)).toBe(4000);
    expect(retryDelayMs(3, null, 1000, 8000)).toBe(8000);
    expect(retryDelayMs(10, null, 1000, 8000)).toBe(8000);
  });
});

describe("createHttpGet", () => {
  it("returns text on success", async () => {
    const httpGet = createHttpGet(5000, {
      fetchImpl: (async () =>
        fakeResponse(200, {}, '{"ok":true}')) as typeof fetch,
    });
    await expect(httpGet("https://x.test/")).resolves.toBe('{"ok":true}');
  });

  it("retries a 429 with Retry-After then succeeds", async () => {
    let calls = 0;
    const httpGet = createHttpGet(5000, {
      maxRetries: 3,
      retryBaseDelayMs: 1,
      retryMaxDelayMs: 2,
      fetchImpl: (async () => {
        calls += 1;
        return calls < 3
          ? fakeResponse(429, { "retry-after": "1" })
          : fakeResponse(200, {}, '"ok"');
      }) as typeof fetch,
    });
    await expect(httpGet("https://x.test/")).resolves.toBe('"ok"');
    expect(calls).toBe(3);
  });

  it("retries a 503 with backoff then fails after exhausting retries", async () => {
    let calls = 0;
    const httpGet = createHttpGet(5000, {
      maxRetries: 2,
      retryBaseDelayMs: 1,
      retryMaxDelayMs: 2,
      fetchImpl: (async () => {
        calls += 1;
        return fakeResponse(503);
      }) as typeof fetch,
    });
    await expect(httpGet("https://x.test/")).rejects.toThrow(NetworkError);
    expect(calls).toBe(3);
  });

  it("does not retry a 404 (permanent failure)", async () => {
    let calls = 0;
    const httpGet = createHttpGet(5000, {
      maxRetries: 3,
      fetchImpl: (async () => {
        calls += 1;
        return fakeResponse(404);
      }) as typeof fetch,
    });
    await expect(httpGet("https://x.test/")).rejects.toThrow(NetworkError);
    expect(calls).toBe(1);
  });

  it("retries transient network errors", async () => {
    let calls = 0;
    const httpGet = createHttpGet(5000, {
      maxRetries: 2,
      retryBaseDelayMs: 1,
      retryMaxDelayMs: 2,
      fetchImpl: (async () => {
        calls += 1;
        if (calls === 1) throw new TypeError("socket hang up");
        return fakeResponse(200, {}, '"retried"');
      }) as typeof fetch,
    });
    await expect(httpGet("https://x.test/")).resolves.toBe('"retried"');
    expect(calls).toBe(2);
  });

  it("throws TimeoutError when the fetch aborts", async () => {
    const httpGet = createHttpGet(10, {
      maxRetries: 0,
      fetchImpl: (async () => {
        const err = new Error("signal timed out");
        err.name = "AbortError";
        throw err;
      }) as typeof fetch,
    });
    await expect(httpGet("https://x.test/")).rejects.toThrow(TimeoutError);
  });
});