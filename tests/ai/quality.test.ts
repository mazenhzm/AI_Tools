import { describe, expect, it } from "vitest";
import { decidePublication, scoreEnrichment } from "@/lib/ai/quality";
import { validEnrichment, weakEnrichment } from "./fixtures";

describe("scoreEnrichment", () => {
  it("scores a complete enrichment highly", () => {
    const result = scoreEnrichment(validEnrichment());
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("scores an incomplete enrichment low", () => {
    const result = scoreEnrichment(weakEnrichment());
    expect(result.score).toBeLessThan(50);
  });

  it("penalizes additional warnings", () => {
    const clean = scoreEnrichment(validEnrichment());
    const warned = scoreEnrichment(validEnrichment(), ["unknown url"]);
    expect(warned.score).toBeLessThan(clean.score);
  });

  it("never exceeds 0..100", () => {
    const result = scoreEnrichment(
      validEnrichment({
        descriptionAr: "أ".repeat(4000),
        descriptionEn: "a".repeat(4000),
      }),
    );
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("decidePublication", () => {
  it("publishes high score + high confidence + no warnings", () => {
    const decision = decidePublication({
      score: 95,
      confidence: 0.9,
      warnings: [],
      minScore: 80,
    });
    expect(decision.status).toBe("published");
    expect(decision.blockedBy).toHaveLength(0);
  });

  it("holds back low scores", () => {
    const decision = decidePublication({
      score: 60,
      confidence: 0.9,
      warnings: [],
      minScore: 80,
    });
    expect(decision.status).toBe("pending_review");
    expect(decision.blockedBy.join(" ")).toContain("minimum");
  });

  it("holds back low confidence", () => {
    const decision = decidePublication({
      score: 95,
      confidence: 0.4,
      warnings: [],
      minScore: 80,
    });
    expect(decision.status).toBe("pending_review");
  });

  it("holds back any warnings even with a perfect score", () => {
    const decision = decidePublication({
      score: 100,
      confidence: 1,
      warnings: ["unknown url"],
      minScore: 80,
    });
    expect(decision.status).toBe("pending_review");
    expect(decision.blockedBy.join(" ")).toContain("unknown url");
  });
});
