import type { AiEnrichment } from "@/lib/ai/schemas";

const AR_LONG =
  "أداة ذكاء اصطناعي تساعد الفرق على تنظيم الملاحظات وتحويل الاجتماعات إلى مهام واضحة. ";
const EN_LONG =
  "An AI tool that helps teams organize notes and turns meetings into clear tasks. ";

export function validEnrichment(
  overrides: Partial<AiEnrichment> = {},
): AiEnrichment {
  return {
    descriptionAr: AR_LONG.repeat(3).trim(),
    descriptionEn: EN_LONG.repeat(3).trim(),
    shortDescriptionAr: "أداة عربية لتنظيم ملاحظات الفريق",
    shortDescriptionEn: "A short English summary for teams",
    categorySlug: "ai-productivity",
    pricingType: "freemium",
    pricingNotes: null,
    tags: ["productivity"],
    features: ["Team collaboration"],
    seoTitleAr: "عنوان تحسين محركات البحث العربي",
    seoDescriptionAr:
      "وصف تحسين محركات البحث العربي للأداة، مكتوب ليكون واضحاً ومفيداً للقارئ.",
    seoTitleEn: "English SEO title",
    seoDescriptionEn: "An English SEO description for the tool, useful and clear.",
    faq: [
      { questionAr: "ما هي هذه الأداة؟", answerAr: "أداة لتنظيم الملاحظات." },
      { questionAr: "هل هي مجانية؟", answerAr: "لديها خطة مجانية محدودة." },
    ],
    confidence: 0.9,
    evidence: [{ claim: "organizes notes", source: "source text" }],
    warnings: [],
    ...overrides,
  };
}

export function weakEnrichment(
  overrides: Partial<AiEnrichment> = {},
): AiEnrichment {
  return {
    descriptionAr: "وصف قصير جداً للأداة دون تفاصيل كافية.",
    descriptionEn: "A very short description without enough detail.",
    shortDescriptionAr: "أداة قصيرة",
    shortDescriptionEn: "Short tool",
    categorySlug: null,
    pricingType: "unknown",
    pricingNotes: null,
    tags: [],
    features: [],
    seoTitleAr: "قصير",
    seoDescriptionAr: "وصف قصير جداً",
    seoTitleEn: "Short",
    seoDescriptionEn: "Too short",
    faq: [],
    confidence: 0.3,
    evidence: [],
    warnings: [],
    ...overrides,
  };
}
