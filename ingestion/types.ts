import type { sources } from "@/lib/db/schema";

export type SourceRow = typeof sources.$inferSelect;

/** Raw item exactly as returned by an adapter, before any interpretation. */
export interface RawSourceItem {
  sourceItemId: string;
  title: string | null;
  link: string | null;
  summary: string | null;
  content: string | null;
  publishedAt: Date | null;
  author: string | null;
  raw: Record<string, unknown>;
}

export interface AdapterContext {
  source: SourceRow;
  /** Injectable HTTP text getter so tests never touch the network. */
  httpGet: (url: string) => Promise<string>;
  timeoutMs: number;
}

export interface SourceAdapter {
  /** Stable registry key, e.g. `rss:generic`, `fixture:json`. */
  readonly key: string;
  /** Human label used in admin/logs. */
  readonly label: string;
  fetchItems(ctx: AdapterContext): Promise<RawSourceItem[]>;
}

/** Item after normalization + validation, ready for dedupe/persistence. */
export interface NormalizedItem {
  sourceItemId: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  domain: string | null;
  summary: string | null;
  contentText: string;
  publishedAt: Date | null;
  normalizedName: string;
  contentHash: string;
  categorySlug: string | null;
}

export type PipelineOutcome =
  | "created"
  | "updated"
  | "duplicate"
  | "invalid"
  | "error";

export interface PipelineItemResult {
  sourceItemId: string;
  outcome: PipelineOutcome;
  toolId: string | null;
  duplicateOfToolId?: string | null;
  error?: string;
}

export interface PipelineMetrics {
  fetched: number;
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  errors: number;
  aiProcessed: number;
  aiFailed: number;
  durationMs: number;
}
