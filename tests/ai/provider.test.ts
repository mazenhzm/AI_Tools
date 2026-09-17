import { describe, expect, it } from "vitest";
import { parseJsonFromModel } from "@/lib/ai/json";
import {
  AiProviderError,
  withRetry,
  type AiProvider,
} from "@/lib/ai/provider";

describe("parseJsonFromModel", () => {
  it("parses a plain JSON object", () => {
    const result = parseJsonFromModel('{"a":1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in markdown fences", () => {
    const result = parseJsonFromModel('```json\n{"a":1}\n```');
    expect(result.ok).toBe(true);
  });

  it("parses JSON surrounded by prose", () => {
    const result = parseJsonFromModel('Here you go: {"a":1} — done');
    expect(result.ok).toBe(true);
  });

  it("fails on empty or non-JSON text", () => {
    expect(parseJsonFromModel("").ok).toBe(false);
    expect(parseJsonFromModel("no object here").ok).toBe(false);
    expect(parseJsonFromModel("{not valid json}").ok).toBe(false);
  });
});

describe("withRetry", () => {
  const noSleep = async () => {};

  function flakyProvider(failures: number, error: unknown): AiProvider {
    let calls = 0;
    return {
      name: "flaky",
      model: "flaky-1",
      async generateJson() {
        calls += 1;
        if (calls <= failures) throw error;
        return { text: '{"ok":true}', model: "flaky-1" };
      },
    };
  }

  it("retries transient errors and eventually succeeds", async () => {
    const provider = flakyProvider(
      2,
      new AiProviderError("rate limited", true),
    );
    const result = await withRetry(() => provider.generateJson({ system: "", prompt: "" }), {
      attempts: 3,
      baseDelayMs: 1,
      sleep: noSleep,
    });
    expect(result.text).toBe('{"ok":true}');
  });

  it("does not retry permanent errors", async () => {
    let calls = 0;
    const provider: AiProvider = {
      name: "perm",
      model: "perm-1",
      async generateJson() {
        calls += 1;
        throw new AiProviderError("bad request", false);
      },
    };
    await expect(
      withRetry(() => provider.generateJson({ system: "", prompt: "" }), {
        attempts: 3,
        baseDelayMs: 1,
        sleep: noSleep,
      }),
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(calls).toBe(1);
  });

  it("stops after the configured number of attempts", async () => {
    let calls = 0;
    const provider: AiProvider = {
      name: "always",
      model: "always-1",
      async generateJson() {
        calls += 1;
        throw new AiProviderError("timeout", true);
      },
    };
    await expect(
      withRetry(() => provider.generateJson({ system: "", prompt: "" }), {
        attempts: 3,
        baseDelayMs: 1,
        sleep: noSleep,
      }),
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(calls).toBe(3);
  });
});
