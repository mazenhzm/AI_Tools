import { describe, expect, it } from "vitest";
import { buildEnrichmentPrompt } from "@/lib/ai/prompts";
import type { NormalizedItem } from "@/ingestion/types";

const item: NormalizedItem = {
  sourceItemId: "acme-1",
  name: "Acme Writer",
  slug: "acme-writer",
  websiteUrl: "https://acme-writer.example.com",
  domain: "acme-writer.example.com",
  summary: "An AI writing assistant.",
  contentText: "Acme Writer drafts and edits long-form content.",
  publishedAt: new Date("2026-06-01T10:00:00Z"),
  normalizedName: "acme writer",
  contentHash: "hash",
  categorySlug: null,
};

describe("buildEnrichmentPrompt", () => {
  const built = buildEnrichmentPrompt({
    item,
    categories: [
      { slug: "ai-productivity", nameAr: "الإنتاجية", nameEn: "Productivity" },
    ],
    tags: [{ slug: "writing", nameAr: "كتابة", nameEn: "Writing" }],
    features: [
      { slug: "api-access", nameAr: "واجهة برمجية", nameEn: "API access" },
    ],
  });

  it("states Arabic-first anti-hallucination rules", () => {
    expect(built.system).toContain("Never invent");
    expect(built.system).toContain("Arabic");
  });

  it("embeds the tool name and source text", () => {
    expect(built.prompt).toContain("Acme Writer");
    expect(built.prompt).toContain("drafts and edits long-form content");
  });

  it("lists allowed categories for classification", () => {
    expect(built.prompt).toContain("ai-productivity");
  });

  it("includes the JSON template keys", () => {
    expect(built.prompt).toContain("descriptionAr");
    expect(built.prompt).toContain("confidence");
  });
});
