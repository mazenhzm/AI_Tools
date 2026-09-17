import type { NormalizedItem } from "@/ingestion/types";
import type { AiEnrichment } from "./schemas";

const URL_REGEX = /https?:\/\/[^\s)"'<>]+/gi;

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface FactCheckContext {
  item: NormalizedItem;
  allowedCategorySlugs: string[];
}

export interface FactCheckResult {
  warnings: string[];
  unknownUrls: string[];
  categoryValid: boolean;
}

/**
 * Hallucination guard. It cannot prove a sentence is true, but it can catch the
 * cheapest lies: URLs that appear nowhere in the source and categories that do
 * not exist. Results become `warnings` (and can block auto-publish).
 */
export function checkEnrichmentFacts(
  enrichment: AiEnrichment,
  context: FactCheckContext,
): FactCheckResult {
  const { item, allowedCategorySlugs } = context;
  const warnings: string[] = [];

  const allowedHosts = new Set<string>();
  if (item.websiteUrl) {
    const host = hostOf(item.websiteUrl);
    if (host) allowedHosts.add(host);
  }
  const sourceText = [item.name, item.summary ?? "", item.contentText].join("\n");
  for (const url of extractUrls(sourceText)) {
    const host = hostOf(url);
    if (host) allowedHosts.add(host);
  }

  const generatedText = [
    enrichment.descriptionAr,
    enrichment.descriptionEn,
    enrichment.longDescriptionAr ?? "",
    enrichment.longDescriptionEn ?? "",
    enrichment.faq.map((faq) => `${faq.questionAr} ${faq.answerAr}`).join(" "),
  ].join("\n");

  const unknownUrls = [...new Set(extractUrls(generatedText))].filter((url) => {
    const host = hostOf(url);
    return host !== null && !allowedHosts.has(host);
  });
  if (unknownUrls.length > 0) {
    warnings.push(
      `generated content references URLs not present in the source: ${unknownUrls.join(", ")}`,
    );
  }

  const categoryValid =
    enrichment.categorySlug === null ||
    allowedCategorySlugs.includes(enrichment.categorySlug);
  if (!categoryValid) {
    warnings.push(
      `unknown category slug "${enrichment.categorySlug}" (will be left unassigned)`,
    );
  }

  if (enrichment.evidence.length === 0) {
    warnings.push("model returned no evidence for its claims");
  }

  if (enrichment.confidence < 0.5) {
    warnings.push(`low model confidence (${enrichment.confidence})`);
  }

  return { warnings, unknownUrls, categoryValid };
}
