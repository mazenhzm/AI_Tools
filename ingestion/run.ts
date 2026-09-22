import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { env } from "@/lib/env";
import * as s from "@/lib/db/schema";
import { runSource, type EnrichFn, type RunSourceResult } from "./pipeline";
import { sleepMs } from "./timeout";

export interface SourceRunSummary {
  sourceId: string;
  sourceName: string;
  adapterKey: string;
  result: RunSourceResult;
}

export interface RunIngestionOptions {
  /** Restrict the pass to a single source id. */
  sourceId?: string;
  /** Cap items per source (useful for demos and safety). */
  maxItems?: number;
  /** Optional AI enrichment hook, wired in the AI phase. */
  enrich?: EnrichFn | null;
}

/**
 * Runs ingestion for every active source (or one source). Sources run
 * sequentially so a misbehaving feed cannot starve the others.
 */
export async function runIngestion(
  options: RunIngestionOptions = {},
): Promise<SourceRunSummary[]> {
  const where = options.sourceId
    ? and(eq(s.sources.active, true), eq(s.sources.id, options.sourceId))
    : eq(s.sources.active, true);

  const sources = await db.select().from(s.sources).where(where);
  // The tools pipeline only handles tool adapters. Model sources belong to the
  // model worker (`worker-models`); resolving them here would fall back to the
  // default RSS adapter and fail the whole run.
  const toolSources = sources.filter(
    (source) => !source.adapterKey.startsWith("model:"),
  );
  const summaries: SourceRunSummary[] = [];

  for (const [index, source] of toolSources.entries()) {
    if (index > 0 && env.ingestionRateLimitDelayMs > 0) {
      await sleepMs(env.ingestionRateLimitDelayMs);
    }
    const result = await runSource({
      sourceId: source.id,
      maxItems: options.maxItems,
      enrich: options.enrich ?? null,
    });
    summaries.push({
      sourceId: source.id,
      sourceName: source.name,
      adapterKey: source.adapterKey,
      result,
    });
  }

  return summaries;
}

export function summarizeRuns(summaries: SourceRunSummary[]): {
  sources: number;
  fetched: number;
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  errors: number;
  aiProcessed: number;
  aiFailed: number;
} {
  return summaries.reduce(
    (acc, summary) => {
      acc.fetched += summary.result.metrics.fetched;
      acc.created += summary.result.metrics.created;
      acc.updated += summary.result.metrics.updated;
      acc.duplicates += summary.result.metrics.duplicates;
      acc.invalid += summary.result.metrics.invalid;
      acc.errors += summary.result.metrics.errors;
      acc.aiProcessed += summary.result.metrics.aiProcessed;
      acc.aiFailed += summary.result.metrics.aiFailed;
      return acc;
    },
    {
      sources: summaries.length,
      fetched: 0,
      created: 0,
      updated: 0,
      duplicates: 0,
      invalid: 0,
      errors: 0,
      aiProcessed: 0,
      aiFailed: 0,
    },
  );
}
