import { describe, expect, it } from "vitest";
import { resolveTimeoutMs } from "@/ingestion/timeout";

describe("resolveTimeoutMs", () => {
  it("falls back to the default when configured value is absent", () => {
    expect(resolveTimeoutMs(undefined)).toBe(30000);
    expect(resolveTimeoutMs(null)).toBe(30000);
    expect(resolveTimeoutMs("")).toBe(30000);
  });

  it("rejects the NaN trap produced by Number(undefined)", () => {
    expect(resolveTimeoutMs(Number(undefined))).toBe(30000);
  });

  it("rejects non-finite and non-positive values", () => {
    expect(resolveTimeoutMs(Number.NaN)).toBe(30000);
    expect(resolveTimeoutMs(Number.POSITIVE_INFINITY)).toBe(30000);
    expect(resolveTimeoutMs(-5)).toBe(30000);
    expect(resolveTimeoutMs(0)).toBe(30000);
  });

  it("accepts valid positive numeric strings and numbers", () => {
    expect(resolveTimeoutMs(5000)).toBe(5000);
    expect(resolveTimeoutMs("15000")).toBe(15000);
  });

  it("accepts a custom fallback", () => {
    expect(resolveTimeoutMs(undefined, 1000)).toBe(1000);
  });
});