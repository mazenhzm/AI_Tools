import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import type { NormalizedModel } from "@/lib/validation/models";
import { isUniqueViolation } from "@/lib/db/errors";
import type { SourceRow } from "./types";

export type ModelUpdateKind = (typeof s.modelUpdateKind.enumValues)[number];

export interface ModelChange {
  field: string;
  labelAr: string;
  before: unknown;
  after: unknown;
  kind: ModelUpdateKind;
}

const KIND_PRIORITY: ModelUpdateKind[] = [
  "pricing",
  "context_window",
  "availability",
  "modality",
  "new_version",
  "metadata",
];

function comparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return [...value].sort().join(",");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const str = String(value).trim();
  // Postgres `numeric` columns surface canonical strings like "1.000000";
  // compare them numerically so a stored "1" is not reported as a price change.
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = Number(str);
    if (Number.isFinite(num)) return num.toString();
  }
  return str;
}

/**
 * Compares the stored model facts with a freshly normalized model and returns
 * the human-readable changes plus the dominant update kind. Only factual fields
 * participate — free text such as descriptions never triggers an update.
 */
export function detectModelChanges(
  row: typeof s.models.$inferSelect,
  next: NormalizedModel,
): ModelChange[] {
  const checks: Array<{
    field: string;
    labelAr: string;
    before: unknown;
    after: unknown;
    kind: ModelUpdateKind;
  }> = [
    {
      field: "name",
      labelAr: "الاسم",
      before: row.name,
      after: next.name,
      kind: "metadata",
    },
    {
      field: "modelIdentifier",
      labelAr: "معرّف النموذج",
      before: row.modelIdentifier,
      after: next.modelIdentifier,
      kind: "metadata",
    },
    {
      field: "releaseDate",
      labelAr: "تاريخ الإصدار",
      before: row.releaseDate,
      after: next.releaseDate,
      kind: "metadata",
    },
    {
      field: "currentVersion",
      labelAr: "الإصدار الحالي",
      before: row.currentVersion,
      after: next.currentVersion,
      kind: "new_version",
    },
    {
      field: "isDownloadable",
      labelAr: "توفر التحميل",
      before: row.isDownloadable,
      after: next.isDownloadable,
      kind: "availability",
    },
    {
      field: "contextWindow",
      labelAr: "نافذة السياق",
      before: row.contextWindow,
      after: next.contextWindow,
      kind: "context_window",
    },
    {
      field: "inputPricePer1M",
      labelAr: "سعر الإدخال لكل مليون رمز",
      before: row.inputPricePer1M,
      after: next.inputPricePer1M,
      kind: "pricing",
    },
    {
      field: "outputPricePer1M",
      labelAr: "سعر الإخراج لكل مليون رمز",
      before: row.outputPricePer1M,
      after: next.outputPricePer1M,
      kind: "pricing",
    },
    {
      field: "pricingNotes",
      labelAr: "ملاحظات التسعير",
      before: row.pricingNotes,
      after: next.pricingNotes,
      kind: "pricing",
    },
    {
      field: "modalities",
      labelAr: "الأنماط المدعومة",
      before: row.modalities,
      after: next.modalities,
      kind: "modality",
    },
    {
      field: "websiteUrl",
      labelAr: "الموقع الرسمي",
      before: row.websiteUrl,
      after: next.websiteUrl,
      kind: "metadata",
    },
  ];

  return checks
    .filter((check) => comparable(check.before) !== comparable(check.after))
    .map(({ field, labelAr, before, after, kind }) => ({
      field,
      labelAr,
      before,
      after,
      kind,
    }));
}

function dominantKind(changes: ModelChange[]): ModelUpdateKind {
  for (const kind of KIND_PRIORITY) {
    if (changes.some((change) => change.kind === kind)) return kind;
  }
  return "metadata";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "غير معروف";
  if (typeof value === "boolean") return value ? "متاح" : "غير متاح";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value).toLocaleString("ar-EG");
  }
  if (Array.isArray(value)) return (value as string[]).join(" + ");
  return String(value);
}

export function describeModelChanges(changes: ModelChange[]): string {
  return changes
    .map(
      (change) => `${change.labelAr}: ${formatValue(change.before)} → ${formatValue(change.after)}`,
    )
    .join("\n");
}

export function modelChangeTitle(changes: ModelChange[]): string {
  return changes.map((change) => change.labelAr).join("، ");
}

export type ModelUpdateOutcome = "created" | "exists" | "skipped";

export interface RecordModelUpdateInput {
  modelId: string;
  changes: ModelChange[];
  kind: ModelUpdateKind;
  contentAr: string;
  contentEn?: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
}

/**
 * Records a detected model change as a draft model update. Keyed by
 * `source_url` (partial unique index) so re-seeing the same change is a no-op
 * and concurrent runs cannot duplicate it. History is never overwritten.
 */
export async function recordModelUpdate(
  database: Db,
  input: RecordModelUpdateInput,
): Promise<ModelUpdateOutcome> {
  const sourceUrl = input.sourceUrl?.trim() || null;
  if (!sourceUrl || input.changes.length === 0) return "skipped";

  const [existing] = await database
    .select({ id: s.modelUpdates.id })
    .from(s.modelUpdates)
    .where(
      and(
        eq(s.modelUpdates.modelId, input.modelId),
        eq(s.modelUpdates.sourceUrl, sourceUrl),
      ),
    )
    .limit(1);
  if (existing) return "exists";

  try {
    await database.insert(s.modelUpdates).values({
      modelId: input.modelId,
      kind: input.kind,
      title: modelChangeTitle(input.changes),
      contentAr: input.contentAr,
      contentEn: input.contentEn ?? "",
      sourceUrl,
      snapshot: {
        changes: input.changes.map((change) => ({
          field: change.field,
          before: change.before,
          after: change.after,
        })),
      },
      status: "draft",
      publishedAt: input.publishedAt,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "exists";
    throw error;
  }

  await database
    .update(s.models)
    .set({ updatedAt: sql`now()` })
    .where(eq(s.models.id, input.modelId));

  return "created";
}

export { dominantKind };

export type ModelRow = typeof s.models.$inferSelect;

export function sourceConfig(source: SourceRow): Record<string, unknown> {
  return (source.config ?? {}) as Record<string, unknown>;
}