import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/errors";
import { slugify } from "@/lib/utils/text";
import type { NormalizedModel } from "@/lib/validation/models";
import { createHttpGet } from "../adapters/http";
import { classifyError } from "../errors";
import { resolveModelAdapter } from "./registry";
import { resolveTimeoutMs } from "../timeout";
import { normalizeModelItem } from "./normalize";
import {
  describeModelChanges,
  detectModelChanges,
  dominantKind,
  recordModelUpdate,
} from "./update-monitor";
import type {
  ModelPipelineItemResult,
  ModelPipelineMetrics,
  ModelPipelineOutcome,
  RawModelItem,
  SourceRow,
} from "./types";

export interface RunModelSourceOptions {
  sourceId: string;
  database?: Db;
  httpGet?: (url: string) => Promise<string>;
  timeoutMs?: number;
  maxItems?: number;
}

export interface RunModelSourceResult {
  runId: string;
  status: "completed" | "failed" | "partial";
  metrics: ModelPipelineMetrics;
  items: ModelPipelineItemResult[];
}

function emptyMetrics(): ModelPipelineMetrics {
  return {
    fetched: 0,
    created: 0,
    updated: 0,
    duplicates: 0,
    invalid: 0,
    errors: 0,
    durationMs: 0,
  };
}

function asJson(value: unknown): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

async function ensureProvider(
  database: Db,
  providerName: string,
): Promise<string> {
  if (!providerName.trim()) return "";
  const slug = slugify(providerName);
  const [existing] = await database
    .select({ id: s.modelProviders.id })
    .from(s.modelProviders)
    .where(eq(s.modelProviders.slug, slug))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await database
    .insert(s.modelProviders)
    .values({ name: providerName, slug })
    .returning();
  return created.id;
}

async function findExistingModel(
  database: Db,
  sourceId: string,
  normalized: NormalizedModel,
  providerId: string | null,
): Promise<{ modelId: string; anchored: boolean } | null> {
  const anchored = await database
    .select({ modelId: s.modelSources.modelId })
    .from(s.modelSources)
    .where(
      and(
        eq(s.modelSources.sourceId, sourceId),
        eq(s.modelSources.sourceItemId, normalized.sourceItemId),
      ),
    )
    .limit(1);
  if (anchored.length > 0 && anchored[0].modelId) {
    return { modelId: anchored[0].modelId, anchored: true };
  }

  if (providerId) {
    const byIdentifier =
      normalized.modelIdentifier &&
      (await database
        .select({ id: s.models.id })
        .from(s.models)
        .where(
          and(
            eq(s.models.providerId, providerId),
            eq(s.models.modelIdentifier, normalized.modelIdentifier),
          ),
        )
        .limit(1));
    if (byIdentifier && byIdentifier.length > 0) {
      return { modelId: byIdentifier[0].id, anchored: false };
    }
    const bySlug = await database
      .select({ id: s.models.id })
      .from(s.models)
      .where(and(eq(s.models.providerId, providerId), eq(s.models.slug, normalized.slug)))
      .limit(1);
    if (bySlug.length > 0) return { modelId: bySlug[0].id, anchored: false };
  }

  return null;
}

interface ProcessArgs {
  database: Db;
  runId: string;
  source: SourceRow;
  raw: RawModelItem;
  metrics: ModelPipelineMetrics;
  items: ModelPipelineItemResult[];
}

async function processModelItem(args: ProcessArgs): Promise<void> {
  const { database, runId, source, raw, metrics, items } = args;

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

  let normalized: NormalizedModel;
  try {
    normalized = normalizeModelItem(raw);
  } catch (err) {
    const classified = classifyError(err);
    metrics.invalid += 1;
    await database
      .update(s.ingestionItems)
      .set({ status: "error", error: `[${classified.kind}] ${classified.message}` })
      .where(eq(s.ingestionItems.id, itemRow.id));
    items.push({
      sourceItemId: raw.sourceItemId,
      outcome: "invalid",
      modelId: null,
      error: classified.message,
    });
    return;
  }

  const providerId = normalized.providerName
    ? await ensureProvider(database, normalized.providerName)
    : null;
  const existing = await findExistingModel(
    database,
    source.id,
    normalized,
    providerId,
  );

  const attachSource = async (modelId: string) => {
    await database
      .insert(s.modelSources)
      .values({
        modelId,
        sourceId: source.id,
        sourceItemId: raw.sourceItemId,
        rawData: asJson(raw.raw),
        normalizedData: asJson(normalized),
        contentHash: normalized.contentHash,
      })
      .onConflictDoNothing();
  };

  if (existing) {
    const [model] = await database
      .select()
      .from(s.models)
      .where(eq(s.models.id, existing.modelId))
      .limit(1);
    if (!model) {
      metrics.errors += 1;
      await database
        .update(s.ingestionItems)
        .set({ status: "error", error: "model row missing" })
        .where(eq(s.ingestionItems.id, itemRow.id));
      items.push({
        sourceItemId: raw.sourceItemId,
        outcome: "error",
        modelId: existing.modelId,
        error: "model row missing",
      });
      return;
    }

    const changes = detectModelChanges(model, normalized);
    if (changes.length > 0) {
      const outcome = await recordModelUpdate(database, {
        modelId: model.id,
        changes,
        kind: dominantKind(changes),
        contentAr: describeModelChanges(changes),
        sourceUrl:
          raw.sourceUrl ??
          normalized.sourceUrl ??
          (typeof raw.raw.link === "string" ? raw.raw.link : null),
        publishedAt: normalized.publishedAt,
      });
      if (outcome === "created") {
        metrics.updated += 1;
        await database
          .update(s.models)
          .set({
            name: normalized.name,
            modelIdentifier: normalized.modelIdentifier ?? "",
            releaseDate: normalized.releaseDate,
            currentVersion: normalized.currentVersion,
            isDownloadable: normalized.isDownloadable,
            contextWindow: normalized.contextWindow,
            inputPricePer1M: normalized.inputPricePer1M,
            outputPricePer1M: normalized.outputPricePer1M,
            pricingNotes: normalized.pricingNotes,
            modalities: normalized.modalities,
            websiteUrl: normalized.websiteUrl,
            updatedAt: new Date(),
          })
          .where(eq(s.models.id, model.id));
        if (existing.anchored) {
          await database
            .update(s.modelSources)
            .set({
              contentHash: normalized.contentHash,
              normalizedData: asJson(normalized),
              lastSeenAt: new Date(),
            })
            .where(
              and(
                eq(s.modelSources.sourceId, source.id),
                eq(s.modelSources.sourceItemId, raw.sourceItemId),
              ),
            );
        } else {
          await attachSource(model.id);
        }
        await database
          .update(s.ingestionItems)
          .set({ status: "updated", modelId: model.id })
          .where(eq(s.ingestionItems.id, itemRow.id));
        items.push({
          sourceItemId: raw.sourceItemId,
          outcome: "updated",
          modelId: model.id,
        });
        return;
      }
      // outcome "exists" (already recorded for this source url) → fall-through
      // to the unchanged path below; do not re-apply facts.
    }

    // Unchanged: keep the anchor fresh (or attach one) and count a duplicate.
    if (existing.anchored) {
      await database
        .update(s.modelSources)
        .set({ lastSeenAt: new Date() })
        .where(
          and(
            eq(s.modelSources.sourceId, source.id),
            eq(s.modelSources.sourceItemId, raw.sourceItemId),
          ),
        );
    } else {
      await attachSource(model.id);
    }
    metrics.duplicates += 1;
    await database
      .update(s.ingestionItems)
      .set({ status: "duplicate", modelId: model.id })
      .where(eq(s.ingestionItems.id, itemRow.id));
    items.push({
      sourceItemId: raw.sourceItemId,
      outcome: "duplicate",
      modelId: model.id,
    });
    return;
  }

  // New model.
  let modelId: string;
  try {
    const created = await database.transaction(async (tx) => {
      const [model] = await tx
        .insert(s.models)
        .values({
          providerId,
          name: normalized.name,
          slug: normalized.slug,
          modelIdentifier: normalized.modelIdentifier ?? "",
          releaseDate: normalized.releaseDate,
          currentVersion: normalized.currentVersion,
          isDownloadable: normalized.isDownloadable,
          contextWindow: normalized.contextWindow,
          inputPricePer1M: normalized.inputPricePer1M,
          outputPricePer1M: normalized.outputPricePer1M,
          pricingNotes: normalized.pricingNotes,
          modalities: normalized.modalities,
          websiteUrl: normalized.websiteUrl,
          descriptionAr: "",
          descriptionEn: "",
          status: "draft",
        })
        .returning();
      await tx.insert(s.modelSources).values({
        modelId: model.id,
        sourceId: source.id,
        sourceItemId: raw.sourceItemId,
        rawData: asJson(raw.raw),
        normalizedData: asJson(normalized),
        contentHash: normalized.contentHash,
      });
      return model;
    });
    modelId = created.id;
    metrics.created += 1;
    await database
      .update(s.ingestionItems)
      .set({ status: "normalized", modelId })
      .where(eq(s.ingestionItems.id, itemRow.id));
    items.push({ sourceItemId: raw.sourceItemId, outcome: "created", modelId });
    return;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existingModel = await findExistingModel(
        database,
        source.id,
        normalized,
        providerId,
      );
      const resolved = existingModel?.modelId ?? "";
      metrics.duplicates += 1;
      if (resolved) await attachSource(resolved);
      await database
        .update(s.ingestionItems)
        .set({
          status: resolved ? "duplicate" : "error",
          modelId: resolved || null,
          error: resolved ? null : "unique violation with no match",
        })
        .where(eq(s.ingestionItems.id, itemRow.id));
      items.push({
        sourceItemId: raw.sourceItemId,
        outcome: resolved ? "duplicate" : "error",
        modelId: resolved || null,
        error: resolved ? undefined : "unique violation with no match",
      });
      return;
    }
    throw error;
  }
}

/**
 * Runs one ingestion pass over a model source. Item-level problems are
 * isolated and the run is finalized with metrics (mirrors the tool pipeline).
 */
export async function runModelSource(
  options: RunModelSourceOptions,
): Promise<RunModelSourceResult> {
  const database = options.database ?? defaultDb;

  const [source] = await database
    .select()
    .from(s.sources)
    .where(eq(s.sources.id, options.sourceId))
    .limit(1);
  if (!source) throw new Error(`source not found: ${options.sourceId}`);

  const adapter = resolveModelAdapter(source.adapterKey);
  const timeoutMs =
    options.timeoutMs ??
    resolveTimeoutMs((source.config as Record<string, unknown> | null)?.timeoutMs);
  const httpGet = options.httpGet ?? createHttpGet(timeoutMs);
  const metrics = emptyMetrics();
  const items: ModelPipelineItemResult[] = [];
  const startedAt = Date.now();

  const [run] = await database
    .insert(s.ingestionRuns)
    .values({ sourceId: source.id, status: "running", metrics: {} })
    .returning();

  let rawItems: RawModelItem[] = [];
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
    return { runId: run.id, status: "failed", metrics, items };
  }

  if (options.maxItems && rawItems.length > options.maxItems) {
    rawItems = rawItems.slice(0, options.maxItems);
  }
  metrics.fetched = rawItems.length;

  for (const raw of rawItems) {
    try {
      await processModelItem({ database, runId: run.id, source, raw, metrics, items });
    } catch (err) {
      const classified = classifyError(err);
      metrics.errors += 1;
      items.push({
        sourceItemId: raw.sourceItemId,
        outcome: "error",
        modelId: null,
        error: `[${classified.kind}] ${classified.message}`,
      });
    }
  }

  metrics.durationMs = Date.now() - startedAt;
  const succeeded =
    metrics.created + metrics.updated + metrics.duplicates + metrics.invalid;
  const status: RunModelSourceResult["status"] =
    metrics.errors === 0 ? "completed" : succeeded > 0 ? "partial" : "failed";

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

  return { runId: run.id, status, metrics, items };
}

export type { ModelPipelineOutcome };