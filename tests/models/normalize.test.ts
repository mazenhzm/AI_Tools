import { describe, expect, it } from "vitest";
import { normalizeModelItem } from "@/ingestion/models/normalize";
import { ValidationError } from "@/ingestion/errors";
import type { RawModelItem } from "@/ingestion/models/types";
import { MODEL_FACT_FIELDS, normalizedModelSchema } from "@/lib/validation/models";

function raw(overrides: Partial<RawModelItem> = {}): RawModelItem {
  return {
    sourceItemId: "entry-1",
    name: "Alpha Chat",
    modelId: "alpha-chat",
    provider: "Acme AI",
    releaseDate: null,
    currentVersion: "1.0",
    isDownloadable: false,
    contextWindow: 128000,
    inputPricePer1M: null,
    outputPricePer1M: null,
    pricingNotes: null,
    modalities: ["text"],
    websiteUrl: "https://acme.example.com/alpha",
    sourceUrl: "https://acme.example.com/alpha/changelog",
    summary: "A model.",
    content: null,
    publishedAt: null,
    raw: {},
    ...overrides,
  };
}

describe("normalizeModelItem", () => {
  it("derives provider-qualified slugs", () => {
    expect(normalizeModelItem(raw()).slug).toBe("acme-ai-alpha-chat");
  });

  it("falls back to the bare model slug when no provider is known", () => {
    const normalized = normalizeModelItem(raw({ provider: null }));
    expect(normalized.slug).toBe("alpha-chat");
  });

  it("keeps unknown facts as null instead of inventing values", () => {
    const normalized = normalizeModelItem(
      raw({
        contextWindow: null,
        inputPricePer1M: null,
        outputPricePer1M: null,
        currentVersion: null,
        releaseDate: null,
        modalities: [],
      }),
    );
    expect(normalized.contextWindow).toBeNull();
    expect(normalized.inputPricePer1M).toBeNull();
    expect(normalized.currentVersion).toBeNull();
    expect(normalized.modalities).toEqual([]);
  });

  it("touches only factual fields in the content hash", () => {
    const base = raw();
    const withSummary = normalizeModelItem(raw({ summary: "different text" }));
    const withContent = normalizeModelItem(raw({ content: "different body" }));
    expect(withSummary.contentHash).toBe(normalizeModelItem(base).contentHash);
    expect(withContent.contentHash).toBe(normalizeModelItem(base).contentHash);

    const withPrice = normalizeModelItem(raw({ inputPricePer1M: 9.99 }));
    expect(withPrice.contentHash).not.toBe(normalizeModelItem(base).contentHash);
  });

  it("requires a usable model name", () => {
    expect(() => normalizeModelItem(raw({ name: " " }))).toThrow(ValidationError);
  });

  it("outputs a schema-valid normalized model", () => {
    const normalized = normalizeModelItem(raw());
    expect(normalizedModelSchema.safeParse(normalized).success).toBe(true);
    for (const field of MODEL_FACT_FIELDS) {
      expect(normalized).toHaveProperty(field);
    }
  });

  it("normalizes and dedupes modalities", () => {
    const normalized = normalizeModelItem(
      raw({ modalities: ["Text", "text", "IMAGE", ""] }),
    );
    expect(normalized.modalities).toEqual(["text", "image"]);
  });
});