import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import { isUniqueViolation } from "@/lib/db/errors";
import * as s from "@/lib/db/schema";
import { createHttpGet } from "./adapters/http";
import { findExistingTool } from "./dedupe";
import { classifyError } from "./errors";
import { normalizeItem } from "./normalize";
import { resolveAdapter } from "./registry";
import { resolveTimeoutMs } from "./timeout";
import { recordToolUpdate } from "./update-monitor";
import type {
  NormalizedItem,
  PipelineItemResult,
  PipelineMetrics,
  RawSourceItem,
  SourceRow,
} from "./types";

export interface EnrichArgs {
  toolId: string;
  item: NormalizedItem;
  source: SourceRow;
  ingestionItemId: string | null;
}

export type EnrichFn = (args: EnrichArgs) => Promise<{ ok: boolean; error?: string }>;

export interface RunSourceOptions {
  sourceId: string;
  database?: Db;
  httpGet?: (url: string) => Promise<string>;
  timeoutMs?: number;
  enrich?: EnrichFn | null;
  maxItems?: number;
}

export interface RunSourceResult {
  runId: string;
  status: "completed" | "failed" | "partial";
  metrics: PipelineMetrics;
  items: PipelineItemResult[];
}

export { isUniqueViolation };

function asJson(value: unknown): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

function emptyMetrics(): PipelineMetrics {
  return {
    fetched: 0,
    created: 0,
    updated: 0,
    duplicates: 0,
    invalid: 0,
    errors: 0,
    aiProcessed: 0,
    aiFailed: 0,
    durationMs: 0,
  };
}

interface ProcessArgs {
  database: Db;
  runId: string;
  source: SourceRow;
  raw: RawSourceItem;
  metrics: PipelineMetrics;
  enrich?: EnrichFn | null;
}

async function processItem(args: ProcessArgs): Promise<PipelineItemResult> {
  const { database, runId, source, raw, metrics, enrich } = args;

  const [itemRow] = await database
    .insert(s.ingestionItems)
    .values({
      runId,
      sourceId: source.id,
      sourceItemId: raw.sourceItemId,
      status: "fetched",
      rawData: asJson(raw.raw),
    })
    .returning();

  let normalized: NormalizedItem;
  try {
    normalized = normalizeItem(raw, {
      defaultCategorySlug:
        (source.config as Record<string, unknown> | null)?.defaultCategorySlug as
          | string
          | null
          | undefined ?? null,
    });
  } catch (err) {
    const classified = classifyError(err);
    metrics.invalid += 1;
    await database
      .update(s.ingestionItems)
      .set({ status: "error", error: `[${classified.kind}] ${classified.message}` })
      .where(eq(s.ingestionItems.id, itemRow.id));
    return {
      sourceItemId: raw.sourceItemId,
      outcome: "invalid",
      toolId: null,
      error: classified.message,
    };
  }

  await database
    .update(s.ingestionItems)
    .set({ status: "normalized", normalizedData: asJson(normalized) })
    .where(eq(s.ingestionItems.id, itemRow.id));

  const match = await findExistingTool(normalized, source.id, database);

  if (match && match.reason === "source_item") {
    const [anchor] = await database
      .select({ id: s.toolSources.id, contentHash: s.toolSources.contentHash })
      .from(s.toolSources)
      .where(
        and(
          eq(s.toolSources.sourceId, source.id),
          eq(s.toolSources.sourceItemId, raw.sourceItemId),
        ),
      )
      .limit(1);

    // Update monitoring: a known source item whose content changed becomes a
    // draft update on the existing tool instead of being silently skipped.
    const changed =
      Boolean(anchor?.contentHash) &&
      anchor?.contentHash !== normalized.contentHash;

    if (anchor && changed && match.toolId) {
      const outcome = await recordToolUpdate(database, {
        toolId: match.toolId,
        title: normalized.name,
        contentAr: normalized.contentText,
        sourceUrl: raw.link ?? normalized.websiteUrl,
        publishedAt: normalized.publishedAt,
      });

      if (outcome === "created") {
        metrics.updated += 1;
        await database
          .update(s.toolSources)
          .set({
            contentHash: normalized.contentHash,
            normalizedData: asJson(normalized),
            lastSeenAt: new Date(),
          })
          .where(eq(s.toolSources.id, anchor.id));
        await database
          .update(s.ingestionItems)
          .set({ status: "updated", toolId: match.toolId })
          .where(eq(s.ingestionItems.id, itemRow.id));
        return {
          sourceItemId: raw.sourceItemId,
          outcome: "updated",
          toolId: match.toolId,
        };
      }
    }

    await database
      .update(s.toolSources)
      .set(
        anchor && !anchor.contentHash
          ? {
              contentHash: normalized.contentHash,
              lastSeenAt: new Date(),
            }
          : { lastSeenAt: new Date() },
      )
      .where(
        and(
          eq(s.toolSources.sourceId, source.id),
          eq(s.toolSources.sourceItemId, raw.sourceItemId),
        ),
      );
    metrics.duplicates += 1;
    await database
      .update(s.ingestionItems)
      .set({ status: "duplicate", toolId: match.toolId })
      .where(eq(s.ingestionItems.id, itemRow.id));
    return {
      sourceItemId: raw.sourceItemId,
      outcome: "duplicate",
      toolId: match.toolId,
      duplicateOfToolId: match.toolId,
    };
  }

  if (match?.toolId) {
    await database
      .insert(s.toolSources)
      .values({
        toolId: match.toolId,
        sourceId: source.id,
        sourceItemId: raw.sourceItemId,
        rawData: asJson(raw.raw),
        normalizedData: asJson(normalized),
        contentHash: normalized.contentHash,
      })
      .onConflictDoNothing();
    metrics.duplicates += 1;
    await database
      .update(s.ingestionItems)
      .set({ status: "duplicate", toolId: match.toolId })
      .where(eq(s.ingestionItems.id, itemRow.id));
    return {
      sourceItemId: raw.sourceItemId,
      outcome: "duplicate",
      toolId: match.toolId,
      duplicateOfToolId: match.toolId,
    };
  }

  let toolId: string;
  try {
    const created = await database.transaction(async (tx) => {
      const [tool] = await tx
        .insert(s.tools)
        .values({
          name: normalized.name,
          slug: normalized.slug,
          websiteUrl: normalized.websiteUrl,
          descriptionAr: "",
          descriptionEn: "",
          status: "draft",
        })
        .returning();
      await tx.insert(s.toolSources).values({
        toolId: tool.id,
        sourceId: source.id,
        sourceItemId: raw.sourceItemId,
        rawData: asJson(raw.raw),
        normalizedData: asJson(normalized),
        contentHash: normalized.contentHash,
      });
      return tool;
    });
    toolId = created.id;
    metrics.created += 1;
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await database
        .select({ id: s.tools.id })
        .from(s.tools)
        .where(eq(s.tools.slug, normalized.slug))
        .limit(1);
      toolId = existing[0]?.id ?? "";
      metrics.duplicates += 1;
      await database
        .update(s.ingestionItems)
        .set({ status: "duplicate", toolId: toolId || null })
        .where(eq(s.ingestionItems.id, itemRow.id));
      return {
        sourceItemId: raw.sourceItemId,
        outcome: "duplicate",
        toolId: toolId || null,
        duplicateOfToolId: toolId || null,
      };
    }
    throw err;
  }

  if (enrich) {
    await database
      .update(s.ingestionItems)
      .set({ status: "ai_processing", toolId })
      .where(eq(s.ingestionItems.id, itemRow.id));
    try {
      const enriched = await enrich({
        toolId,
        item: normalized,
        source,
        ingestionItemId: itemRow.id,
      });
      if (enriched.ok) metrics.aiProcessed += 1;
      else metrics.aiFailed += 1;
      await database
        .update(s.ingestionItems)
        .set({
          status: enriched.ok ? "ai_processed" : "error",
          error: enriched.ok ? null : (enriched.error ?? "ai enrichment failed"),
          toolId,
        })
        .where(eq(s.ingestionItems.id, itemRow.id));
    } catch (err) {
      const classified = classifyError(err);
      metrics.aiFailed += 1;
      await database
        .update(s.ingestionItems)
        .set({ status: "error", error: `[ai] ${classified.message}`, toolId })
        .where(eq(s.ingestionItems.id, itemRow.id));
    }
  } else {
    await database
      .update(s.ingestionItems)
      .set({ status: "validated", toolId })
      .where(eq(s.ingestionItems.id, itemRow.id));
  }

  return {
    sourceItemId: raw.sourceItemId,
    outcome: "created",
    toolId,
  };
}

/**
 * Runs one ingestion pass for a source. Never throws for item-level problems:
 * each item is isolated and recorded, the run is finalized with metrics.
 */
export async function runSource(
  options: RunSourceOptions,
): Promise<RunSourceResult> {
  const database = options.database ?? defaultDb;

  const [source] = await database
    .select()
    .from(s.sources)
    .where(eq(s.sources.id, options.sourceId))
    .limit(1);
  if (!source) throw new Error(`source not found: ${options.sourceId}`);

  const adapter = resolveAdapter(source.adapterKey);
  const timeoutMs =
    options.timeoutMs ??
    resolveTimeoutMs((source.config as Record<string, unknown> | null)?.timeoutMs);
  const httpGet = options.httpGet ?? createHttpGet(timeoutMs);
  const metrics = emptyMetrics();
  const results: PipelineItemResult[] = [];
  const startedAt = Date.now();

  const [run] = await database
    .insert(s.ingestionRuns)
    .values({ sourceId: source.id, status: "running", metrics: {} })
    .returning();

  let rawItems: RawSourceItem[] = [];
  try {
    rawItems = await adapter.fetchItems({ source, httpGet, timeoutMs });
  } catch (err) {
    const classified = classifyError(err);
    metrics.durationMs = Date.now() - startedAt;
    await database
      .update(s.ingestionRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: `[${classified.kind}] ${classified.message}`,
        metrics: { ...metrics, adapter: adapter.key },
      })
      .where(eq(s.ingestionRuns.id, run.id));
    await database
      .update(s.sources)
      .set({ lastFetchedAt: new Date() })
      .where(eq(s.sources.id, source.id));
    return { runId: run.id, status: "failed", metrics, items: results };
  }

  if (options.maxItems && rawItems.length > options.maxItems) {
    rawItems = rawItems.slice(0, options.maxItems);
  }
  metrics.fetched = rawItems.length;

  for (const raw of rawItems) {
    try {
      const result = await processItem({
        database,
        runId: run.id,
        source,
        raw,
        metrics,
        enrich: options.enrich ?? null,
      });
      results.push(result);
    } catch (err) {
      const classified = classifyError(err);
      metrics.errors += 1;
      results.push({
        sourceItemId: raw.sourceItemId,
        outcome: "error",
        toolId: null,
        error: `[${classified.kind}] ${classified.message}`,
      });
    }
  }

  metrics.durationMs = Date.now() - startedAt;
  const succeeded =
    metrics.created + metrics.updated + metrics.duplicates + metrics.invalid;
  const status: RunSourceResult["status"] =
    metrics.errors === 0
      ? "completed"
      : succeeded > 0
        ? "partial"
        : "failed";

  await database
    .update(s.ingestionRuns)
    .set({
      status,
      finishedAt: new Date(),
      metrics: { ...metrics, adapter: adapter.key },
      error: metrics.errors > 0 ? `${metrics.errors} item(s) failed` : null,
    })
    .where(eq(s.ingestionRuns.id, run.id));

  await database
    .update(s.sources)
    .set({
      lastFetchedAt: new Date(),
      ...(status !== "failed" ? { lastSuccessAt: new Date() } : {}),
    })
    .where(eq(s.sources.id, source.id));

  return { runId: run.id, status, metrics, items: results };
}
