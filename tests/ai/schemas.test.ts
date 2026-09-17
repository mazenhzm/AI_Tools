import { describe, expect, it } from "vitest";
import { validateAiEnrichment } from "@/lib/ai/schemas";
import { validEnrichment } from "./fixtures";

describe("validateAiEnrichment", () => {
  it("accepts a complete payload", () => {
    const result = validateAiEnrichment(validEnrichment());
    expect(result.ok).toBe(true);
    expect(result.data?.descriptionAr.length).toBeGreaterThan(40);
  });

  it("rejects a payload missing the Arabic description", () => {
    const { descriptionAr, ...rest } = validEnrichment();
    void descriptionAr;
    const result = validateAiEnrichment(rest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("descriptionAr");
  });

  it("rejects an unknown pricing type", () => {
    const result = validateAiEnrichment(
      validEnrichment({ pricingType: "cheap" as never }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects confidence outside 0..1", () => {
    const result = validateAiEnrichment(validEnrichment({ confidence: 1.5 }));
    expect(result.ok).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateAiEnrichment("nope").ok).toBe(false);
    expect(validateAiEnrichment(null).ok).toBe(false);
  });
});
