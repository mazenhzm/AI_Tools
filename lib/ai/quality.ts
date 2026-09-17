import type { AiEnrichment } from "./schemas";

export const AUTO_PUBLISH_MIN_CONFIDENCE = 0.7;

export interface QualityResult {
  score: number;
  reasons: string[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function lengthBand(
  text: string,
  strong: number,
  good: number,
  strongPoints: number,
  goodPoints: number,
  weakPoints: number,
  label: string,
  reasons: string[],
): number {
  const len = text.trim().length;
  if (len >= strong) {
    reasons.push(`${label}: strong (${len})`);
    return strongPoints;
  }
  if (len >= good) {
    reasons.push(`${label}: good (${len})`);
    return goodPoints;
  }
  reasons.push(`${label}: thin (${len})`);
  return weakPoints;
}

/**
 * Deterministic 0-100 quality score. It measures completeness and safety of the
 * AI output — never the truth of the facts (that is the reviewer's job).
 */
export function scoreEnrichment(
  enrichment: AiEnrichment,
  extraWarnings: string[] = [],
): QualityResult {
  const reasons: string[] = [];
  let score = 0;

  score += lengthBand(
    enrichment.descriptionAr,
    200,
    120,
    22,
    18,
    10,
    "descriptionAr",
    reasons,
  );
  score += lengthBand(
    enrichment.descriptionEn,
    200,
    120,
    13,
    10,
    6,
    "descriptionEn",
    reasons,
  );

  score += lengthBand(
    enrichment.shortDescriptionAr,
    20,
    20,
    7,
    7,
    0,
    "shortDescriptionAr",
    reasons,
  );
  score += lengthBand(
    enrichment.shortDescriptionEn,
    20,
    20,
    6,
    6,
    0,
    "shortDescriptionEn",
    reasons,
  );

  if (enrichment.categorySlug) {
    score += 14;
    reasons.push("category: assigned");
  } else {
    reasons.push("category: missing");
  }

  if (enrichment.pricingType !== "unknown") {
    score += 9;
    reasons.push(`pricing: ${enrichment.pricingType}`);
  } else {
    reasons.push("pricing: unknown");
  }

  const seoOk =
    enrichment.seoTitleAr.length >= 10 &&
    enrichment.seoTitleAr.length <= 70 &&
    enrichment.seoDescriptionAr.length >= 50 &&
    enrichment.seoDescriptionAr.length <= 170;
  if (seoOk) {
    score += 10;
    reasons.push("seo: within limits");
  } else {
    reasons.push("seo: outside recommended limits");
  }

  if (enrichment.faq.length >= 2) {
    score += 9;
    reasons.push(`faq: ${enrichment.faq.length}`);
  } else if (enrichment.faq.length === 1) {
    score += 4;
    reasons.push("faq: only one entry");
  } else {
    reasons.push("faq: none");
  }

  const confidencePoints = Math.round(enrichment.confidence * 10);
  score += confidencePoints;
  reasons.push(`confidence: ${enrichment.confidence}`);

  const warnings = [...enrichment.warnings, ...extraWarnings];
  if (warnings.length > 0) {
    score -= Math.min(20, warnings.length * 4);
    reasons.push(`warnings: ${warnings.length}`);
  }

  return { score: clamp(score), reasons };
}

export interface PublicationDecision {
  status: "published" | "pending_review";
  score: number;
  reasons: string[];
  blockedBy: string[];
}

/**
 * Quality gate: only high-score, high-confidence, warning-free enrichment is
 * auto-published. Everything else waits for a human in `pending_review`.
 */
export function decidePublication(args: {
  score: number;
  confidence: number;
  warnings: string[];
  minScore: number;
}): PublicationDecision {
  const blockedBy: string[] = [];
  if (args.score < args.minScore) {
    blockedBy.push(`score ${args.score} < minimum ${args.minScore}`);
  }
  if (args.confidence < AUTO_PUBLISH_MIN_CONFIDENCE) {
    blockedBy.push(
      `confidence ${args.confidence} < ${AUTO_PUBLISH_MIN_CONFIDENCE}`,
    );
  }
  if (args.warnings.length > 0) {
    blockedBy.push(`warnings: ${args.warnings.join(" | ")}`);
  }

  return {
    status: blockedBy.length === 0 ? "published" : "pending_review",
    score: args.score,
    reasons: [],
    blockedBy,
  };
}
