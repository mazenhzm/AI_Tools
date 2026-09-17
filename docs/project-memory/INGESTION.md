# INGESTION

## Pipeline

```
FETCH → RAW DATA STORAGE → NORMALIZATION → VALIDATION → DEDUPLICATION → AI ENRICHMENT → FACT VALIDATION → QUALITY SCORE → PUBLICATION DECISION
```

## Stages (each isolated, errors never abort the run)

1. **FETCH** — adapter fetches items (RSS parsed with a sanitizing parser; API adapters per source; official adapters per config).
2. **RAW DATA STORAGE** — every raw item persisted (`ingestion_items.raw_data`) before any transformation, for debugging/repro/audit.
3. **NORMALIZATION** — URL canonicalization (scheme/host/www/trailing slash), name normalization (trim/collapse/digit-alikes), ID `source_item_id`, timestamps.
4. **VALIDATION** — Zod item schema: required fields present, URL resolvable-shape, length caps, no obviously malformed data.
5. **DEDUPLICATION** — anchors: `(source_id, source_item_id)`; plus canonical domain + normalized name search; plus matching existing tools by normalized website domain. If matched → increment `duplicates`, optionally refresh `last_seen_at`, skip AI rerun unless force.
6. **AI ENRICHMENT** — build prompt from normalized+raw data; call provider; Zod-validate result (AI_PIPELINE.md).
7. **FACT VALIDATION** — cross-check pricing/category against source; mark unverified as unknown.
8. **QUALITY SCORE** — score fields presence/URL validity/category match/no-unsupported-claims; gate auto-publish against `AUTO_PUBLISH_MIN_SCORE`.
9. **PUBLICATION DECISION** — score ≥ threshold → `published`; else `pending_review`. Optionally `approved`/`ai_processed` intermediate for admin review.
10. **MONITOR (separate job)** — re-checks existing published tools: pricing/website/description signals; changes → `updates` record + AI summarize + quality → publish or review.

## Idempotency guarantees

- Same job run twice → no duplicate tools/updates (unique `(source_id, source_item_id)`).
- UPSERT semantics for tool_sources; skip if unchanged hash.
- Each run recorded; metrics in `ingestion_runs`.

## Adapter contract (`ingestion/sources/base/adapter.ts`)

```ts
interface SourceAdapter {
  fetch(): Promise<RawSourceItem[]>;
  normalize(raw: RawSourceItem): NormalizedItem; // per-adapter overrides
  validate(item: unknown): Result<NormalizedItem>; // zod
}
```

Concrete adapters:
- `sources/rss/rss.adapter.ts` — generic RSS feed (title/link/description/pubDate).
- `sources/product_sources/*.adapter.ts` — product launch feeds/APIs.
- `sources/official/*.adapter.ts` — configured official sites.

## Resilience

- Retry with exponential backoff for network/5xx; classify errors (transient/permanent); rate-limit aware (`fetch` pacing).
- One bad item → `error` status for that item, run continues → run `status = partial` if any failures.
- Gemini failures → item stays `ai_processed` retryable, run marked partial.
- Logs/metrics to `ingestion_runs` and console (structured). No secrets logged.

## Triggering & scheduling

- `npm run worker -- --once` → single pass; `npm run worker` → cron loop (sources table `interval` in config).
- Admin "Run now" triggers one pass for a source via server action → spawns detached child process (isolated, logged) — in dev spawns inline.