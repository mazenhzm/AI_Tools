import type { ModelChange } from "./update-monitor";

/**
 * Hybrid governance model for model facts.
 *
 * Two classes of detected change:
 *  - AUTO_APPLY: low-regret facts the agent already commits to the model row on
 *    the first ingestion that sees them (name, identifiers, context window,
 *    version, modalities, website). Still fully attributed in the update
 *    snapshot and reversible via content revisions.
 *  - REVIEW_REQUIRED: revenue/availability-sensitive facts (pricing) or
 *    judgement calls (open-source classification) that must never be applied
 *    by the agent. They are recorded as draft updates with `pendingReview`
 *    snapshots and only land on the model row when an admin/editor approves or
 *    publishes the update.
 *
 * Values sourced from a source are never invented by the platform — unknown
 * facts stay null (see models README / provenance rules).
 */
export const AUTO_APPLY_MODEL_FIELDS = new Set<string>([
  "name",
  "modelIdentifier",
  "releaseDate",
  "currentVersion",
  "contextWindow",
  "modalities",
  "websiteUrl",
]);

export const REVIEW_REQUIRED_MODEL_FIELDS = new Set<string>([
  "inputPricePer1M",
  "outputPricePer1M",
  "pricingNotes",
  "isDownloadable",
]);

export function isAutoApplyField(field: string): boolean {
  return AUTO_APPLY_MODEL_FIELDS.has(field);
}

export function isReviewRequiredField(field: string): boolean {
  return REVIEW_REQUIRED_MODEL_FIELDS.has(field);
}

export interface ModelChangePartition {
  autoApply: ModelChange[];
  pendingReview: ModelChange[];
}

/** Splits detected changes into the auto-apply and review-required buckets. */
export function partitionModelChanges(
  changes: ModelChange[],
): ModelChangePartition {
  const autoApply: ModelChange[] = [];
  const pendingReview: ModelChange[] = [];
  for (const change of changes) {
    if (isReviewRequiredField(change.field)) pendingReview.push(change);
    else if (isAutoApplyField(change.field)) autoApply.push(change);
    // Unknown fields are never silently applied.
    else pendingReview.push(change);
  }
  return { autoApply, pendingReview };
}

/**
 * Builds a partial `models` row patch from a set of changes (their `after`
 * values). Column names match the change field names exactly.
 */
export function modelPatchFromChanges(
  changes: ModelChange[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const change of changes) {
    if (change.after !== undefined) patch[change.field] = change.after;
  }
  return patch;
}

/** Field labels used by the admin governance queue (Arabic). */
export const FIELD_LABEL_AR: Record<string, string> = {
  name: "الاسم",
  modelIdentifier: "معرّف النموذج",
  releaseDate: "تاريخ الإصدار",
  currentVersion: "الإصدار الحالي",
  isDownloadable: "توفر التحميل",
  contextWindow: "نافذة السياق",
  inputPricePer1M: "سعر الإدخال/1M",
  outputPricePer1M: "سعر الإخراج/1M",
  pricingNotes: "ملاحظات التسعير",
  modalities: "الأنماط المدعومة",
  websiteUrl: "الموقع الرسمي",
};

export function fieldLabelAr(field: string): string {
  return FIELD_LABEL_AR[field] ?? field;
}