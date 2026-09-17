import { z } from "zod";

export const AI_PROMPT_VERSION = "enrich-v1";

export const faqItemSchema = z.object({
  questionAr: z.string().min(4).max(300),
  answerAr: z.string().min(10).max(1500),
  questionEn: z.string().min(4).max(300).optional(),
  answerEn: z.string().min(10).max(1500).optional(),
});

/**
 * The exact JSON contract we accept from an AI provider. Anything outside this
 * shape is rejected by `safeParse` and never persisted — the database columns
 * are the second line of defense.
 */
export const aiEnrichmentSchema = z.object({
  descriptionAr: z.string().min(40).max(4000),
  descriptionEn: z.string().min(40).max(4000),
  shortDescriptionAr: z.string().min(20).max(400),
  shortDescriptionEn: z.string().min(20).max(400),
  longDescriptionAr: z.string().min(120).max(8000).optional(),
  longDescriptionEn: z.string().min(120).max(8000).optional(),
  categorySlug: z.string().min(2).max(120).nullable(),
  pricingType: z.enum(["free", "freemium", "paid", "unknown"]),
  pricingNotes: z.string().max(1000).nullable(),
  tags: z.array(z.string().min(2).max(60)).max(12),
  features: z.array(z.string().min(2).max(120)).max(12),
  bestForAr: z.string().max(500).nullable().optional(),
  seoTitleAr: z.string().min(5).max(70),
  seoDescriptionAr: z.string().min(30).max(170),
  seoTitleEn: z.string().min(5).max(70),
  seoDescriptionEn: z.string().min(30).max(170),
  faq: z.array(faqItemSchema).max(8),
  confidence: z.number().min(0).max(1),
  evidence: z
    .array(
      z.object({
        claim: z.string().min(2).max(500),
        source: z.string().max(500).optional(),
      }),
    )
    .max(20),
  warnings: z.array(z.string().max(500)).max(10),
});

export type AiEnrichment = z.infer<typeof aiEnrichmentSchema>;

/** JSON shape handed to the model as an explicit template inside the prompt. */
export const AI_ENRICHMENT_JSON_TEMPLATE = {
  descriptionAr: "وصف عربي موجز للأداة (40-600 حرف)",
  descriptionEn: "Concise English description (40-600 chars)",
  shortDescriptionAr: "جملة عربية قصيرة",
  shortDescriptionEn: "Short English sentence",
  longDescriptionAr: "وصف عربي مطوّل اختياري",
  longDescriptionEn: "Optional longer English description",
  categorySlug: "one of the provided category slugs, or null",
  pricingType: "free | freemium | paid | unknown",
  pricingNotes: "short pricing note or null",
  tags: ["existing-tag-slug-or-new-lowercase-slug"],
  features: ["feature phrase"],
  bestForAr: "مناسب لـ … أو null",
  seoTitleAr: "عنوان SEO عربي <= 60 حرف",
  seoDescriptionAr: "وصف SEO عربي <= 155 حرف",
  seoTitleEn: "English SEO title <= 60 chars",
  seoDescriptionEn: "English SEO description <= 155 chars",
  faq: [{ questionAr: "سؤال", answerAr: "جواب" }],
  confidence: 0.0,
  evidence: [{ claim: "fact", source: "source text or url" }],
  warnings: ["anything uncertain"],
} as const;

export interface AiEnrichmentParseResult {
  ok: boolean;
  data?: AiEnrichment;
  error?: string;
}

/** Validates an unknown value against the contract (used by the enricher). */
export function validateAiEnrichment(value: unknown): AiEnrichmentParseResult {
  const parsed = aiEnrichmentSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    };
  }
  return { ok: true, data: parsed.data };
}
