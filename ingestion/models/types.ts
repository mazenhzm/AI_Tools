import type { sources } from "@/lib/db/schema";

export type SourceRow = typeof sources.$inferSelect;

/** Raw model entry as returned by a model source adapter. */
export interface RawModelItem {
  sourceItemId: string;
  name: string;
  modelId?: string | null;
  provider?: string | null;
  releaseDate?: string | null;
  currentVersion?: string | null;
  isDownloadable?: boolean | null;
  contextWindow?: number | null;
  inputPricePer1M?: number | null;
  outputPricePer1M?: number | null;
  pricingNotes?: string | null;
  modalities?: string[];
  websiteUrl?: string | null;
  sourceUrl?: string | null;
  summary?: string | null;
  content?: string | null;
  publishedAt?: Date | null;
  raw: Record<string, unknown>;
}

export interface ModelAdapterContext {
  source: SourceRow;
  httpGet: (url: string) => Promise<string>;
  timeoutMs: number;
}

export interface ModelSourceAdapter {
  /** Stable registry key, e.g. `model:fixture`. */
  readonly key: string;
  /** Human label used in admin/logs. */
  readonly label: string;
  fetchItems(ctx: ModelAdapterContext): Promise<RawModelItem[]>;
}

export type ModelPipelineOutcome =
  | "created"
  | "updated"
  | "duplicate"
  | "invalid"
  | "error";

export interface ModelPipelineItemResult {
  sourceItemId: string;
  outcome: ModelPipelineOutcome;
  modelId: string | null;
  error?: string;
}

export interface ModelPipelineMetrics {
  fetched: number;
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  errors: number;
  durationMs: number;
}