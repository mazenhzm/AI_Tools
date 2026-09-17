import type { NormalizedItem } from "@/ingestion/types";
import { AI_ENRICHMENT_JSON_TEMPLATE } from "./schemas";

export interface ReferenceCategory {
  slug: string;
  nameAr: string;
  nameEn: string;
}

export interface ReferenceTerm {
  slug: string;
  nameAr: string;
  nameEn: string;
}

export interface EnrichmentPromptInput {
  item: NormalizedItem;
  categories: ReferenceCategory[];
  tags: ReferenceTerm[];
  features: ReferenceTerm[];
}

export interface BuiltPrompt {
  system: string;
  prompt: string;
}

export function buildEnrichmentPrompt(
  input: EnrichmentPromptInput,
): BuiltPrompt {
  const { item, categories, tags, features } = input;

  const system = [
    "أنت محرر محتوى عربي محترف متخصص في أدوات الذكاء الاصطناعي، وتكتب أيضاً بالإنجليزية.",
    "You are a meticulous bilingual (Arabic-first) editor for an AI tools directory.",
    "ABSOLUTE RULES:",
    "1. Use ONLY the source text provided below. Never invent features, pricing, dates, companies or URLs.",
    "2. If a fact is not present in the source text, either omit it or record it in `warnings` and lower `confidence`.",
    "3. Do NOT add any URL that is not present in the source text or the tool's website.",
    "4. Arabic must be natural Modern Standard Arabic (فصحى), not machine-translated English.",
    "5. Return STRICT JSON only, matching the template exactly. No markdown, no commentary.",
  ].join("\n");

  const categoryList =
    categories.length > 0
      ? categories
          .map((category) => `- ${category.slug} (${category.nameAr} / ${category.nameEn})`)
          .join("\n")
      : "- (none available; use null)";

  const tagList =
    tags.length > 0
      ? tags.map((tag) => `- ${tag.slug}`).join("\n")
      : "- (none available)";

  const featureList =
    features.length > 0
      ? features.map((feature) => `- ${feature.nameAr} / ${feature.nameEn}`).join("\n")
      : "- (none available)";

  const prompt = [
    "=== SOURCE TEXT (the only permitted source of facts) ===",
    `Tool name: ${item.name}`,
    `Website: ${item.websiteUrl ?? "(not provided)"}`,
    `Summary: ${item.summary ?? "(none)"}`,
    `Details: ${item.contentText || "(none)"}`,
    item.publishedAt ? `Source date: ${item.publishedAt.toISOString()}` : "",
    "=== END SOURCE TEXT ===",
    "",
    "Allowed category slugs (choose at most one, or null):",
    categoryList,
    "",
    "Existing tag slugs (reuse when relevant; you may add new lowercase slugs):",
    tagList,
    "",
    "Known feature vocabulary (reuse wording when relevant):",
    featureList,
    "",
    "Return JSON with EXACTLY these keys:",
    JSON.stringify(AI_ENRICHMENT_JSON_TEMPLATE, null, 2),
    "",
    "Rules for the JSON:",
    "- descriptionAr and descriptionEn are required and must be faithful summaries of the source text.",
    "- faq: 2-5 useful questions grounded in the source text (Arabic first).",
    "- confidence: your honest 0..1 confidence in the factual accuracy.",
    "- evidence: one entry per factual claim you made, referencing the source text or the tool website.",
    "- warnings: list anything you could not verify or had to guess.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { system, prompt };
}
