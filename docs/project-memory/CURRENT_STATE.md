# CURRENT STATE

```text
CURRENT PHASE:          Production readiness execution protocol (P0–P11): P0–P3 + P7–P9 verified; P4 BLOCKED-EXTERNAL (Gemini key); P5 needs product-owner decision; P6 BLOCKED-EXTERNAL (SMTP/telegram)
CURRENT STATUS:         Real trusted model source (Hugging Face adapter) + ingestion resilience (retry/backoff/429/Retry-After, timeout fix, source pacing) + real scheduling verified (Windows Task Scheduler dispatched runs, logs + ingestion_runs rows) + SEO hardening (alert pages noindex) + security/backup/observability verified (277 tests, build clean, smoke 28/28, backup/restore drill with row parity)
LAST VERIFIED:          2026-09-22 (typecheck, lint, vitest 277/277 on 37 files, next build, live production start + smoke 28/28, canonical/OG/robots/sitemap over HTTP, security headers + HSTS over HTTP, db:backup + scratch restore 26 tables with exact row parity, Task Scheduler LastTaskResult 0 for both workers, worker exit-signal subprocess tests)

WORKING FEATURES:
  - PostgreSQL schema (26 tables, 11 enums, FKs, partial/unique/GIN indexes) applied to dev + test DBs
  - Drizzle migration pipeline (generate + migrate) with pg_trgm extension bootstrap
  - Idempotent dev seeds: 4 categories, 5 tags, 5 features, 3 clearly-labeled sample tools (2 published for public-site verification), 1 published collection, 2 sources (1 active offline fixture)
  - Admin seeding from env (bcrypt hash, idempotent upsert)
  - Isolated test DB harness (vitest globalSetup resets only *_test databases)
  - Ingestion engine: HTTP client (timeout + classified errors), RSS/Atom adapter, offline fixture adapter, adapter registry
  - Normalization + Zod validation, duplicate detection (source anchor → website URL → slug → normalized name → domain+name)
  - Transactional per-item pipeline with isolated failures, run/item records and metrics, multi-source orchestrator, CLI worker (`npm run worker`)
  - AI enrichment: Gemini provider abstraction, Arabic-first prompt, strict Zod contract, hallucination fact-checks, deterministic quality gate (auto-publish ≥ 80 + confidence ≥ 0.7 + no warnings), transactional persistence, ai_processing_logs audit trail, retry/backoff
  - Admin auth: NextAuth v5 credentials (bcrypt, JWT 8h), proxy-level optimistic guard, single `requireActor`/`requireAdmin` choke point, thin server actions with authz + revalidation
  - Admin UI (Arabic RTL): login, dashboard stats/review queue/recent runs, tools list + detail (status transitions, AI reprocess, featured/affiliate), categories/tags CRUD, collections with ordered curation, sources (toggle + run now), ingestion runs, sponsored campaigns
  - Public site (Arabic RTL, route group `app/(public)`): home (featured/latest/categories/collections), `/tools` directory with q/category/pricing/featured/sort filters + pagination, PG full-text `/search`, tool detail (fields, FAQ, features, tags, updates, related tools, affiliate-aware CTA), category + collection landings, about/contact/privacy/terms
  - Rendering strategy: ISR (SSG + `revalidate`) for home, directory landings and detail pages via `generateStaticParams`; dynamic SSR only where `searchParams` filtering requires it (`/tools`, `/search`)
  - SEO: shared metadata builder (canonical + Open Graph + Twitter) with `metadataBase`, keyword/description defaults, JSON-LD (Organization/WebSite+SearchAction, SoftwareApplication, BreadcrumbList, FAQPage — facts only, no fabricated ratings), `app/sitemap.ts` (static + published tools/categories/collections with `lastModified`), `app/robots.ts` (blocks /admin, /api, /search), Arabic RTL 404 page, optional `GOOGLE_SITE_VERIFICATION`
  - Monetization: env-resolved AdSense slots (`ADSENSE_CLIENT` + `ADSENSE_SLOT_HEADER/IN_CONTENT/SIDEBAR/LISTINGS`) rendered by a server `AdSlot` (header in the public layout, in-content on home, sidebar on tool detail, listings on `/tools`) that renders nothing when unconfigured; affiliate click tracker `GET /api/track/click?tool=<slug>` that resolves the destination from the DB (published tools, http/https only — no open redirect), stores a salted IP hash + truncated UA/referrer in `affiliate_clicks`, then 302s; tool-page CTAs route through the tracker for affiliate tools with an Arabic disclosure, and "أدوات مُموَّلة / محتوى مدفوع" sponsored blocks (home `featured`, `/tools` `listings`) plus a "مُموَّل" badge come from active, in-window `sponsored_listings` rows
  - Shared `lib/services/*` business layer used by both server actions and tests
  - Hardening: baseline security headers + report-only CSP (ad origins allowed) via `next.config.ts`, `X-Powered-By` disabled, HSTS in production only; fixed-window rate limiting on the public click tracker (429 + `Retry-After`); secret-exposure guards; `npm run smoke` HTTP end-to-end runner (18 checks); `docs/project-memory/SECURITY.md`
  - Update monitoring: the pipeline compares each known source item's stored `contentHash` against the incoming one; a change records a draft `updates` row (with `sourceUrl` dedupe), bumps the run's `updated` count and re-baselines the hash, unchanged repeats are duplicates; `item_status` gained `updated`
  - Admin update review: `getToolForAdmin` returns recent updates; `setUpdateStatus` service + thin `setUpdateStatusAction`; the tool detail page renders a "التحديثات المكتشفة" section with Arabic status labels and publish/reject/pending-review forms (state machine enforced in the service, not the UI)
  - Worker observability: `scripts/worker.ts` logs ISO timestamp + level events (with `--json` line mode) and a terminal `run_summary` (sources/fetched/created/updated/duplicates/invalid/errors/aiProcessed/aiFailed/durationMs), exiting non-zero if any source fails
  - Operability: `/admin/runs` shows the full per-run metrics grid; `npm run db:backup` dumps inside the container into `backups/` (refuses empty dumps, prunes to `BACKUP_RETENTION`); `README.md` + `docs/project-memory/OPERATIONS.md` document processes, worker scheduling, logging, backup/restore and the pre-launch checklist
  - Real model source (P1): `ingestion/adapters/hf-models.ts` (`model:huggingface`) — keyless Hugging Face API, downloads-sorted, private/gated/disabled filtered, modalities derived from pipeline_tag/tags, unknown pricing/contextWindow nulled; registered in `ingestion/models/registry.ts`; inactive dev source `hf-models-api`; real fetch verified once (8 drafts created, dev DB then reset to canonical)
  - Ingestion resilience (P2): `ingestion/timeout.ts` (`resolveTimeoutMs`, `sleepMs`) kills the NaN-timeout bug in both pipelines; `ingestion/adapters/http.ts` `createHttpGet` retries with exponential backoff, honours 429 + Retry-After and retries only transient 5xx/network (no retry on 4xx); `INGESTION_RATE_LIMIT_DELAY_MS` now paces multi-source runs
  - Real scheduling (P3): Windows Task Scheduler tasks `AIDiscovery-IngestionTools`/`AIDiscovery-IngestionModels` (daily 02:00, repeat 6h) dispatch successfully — real worker logs + `ingestion_runs` rows; registered with `AllowStartIfOnBatteries` (laptop hosts else stuck Queued) and interactive logon; `runIngestion` excludes `model:*` sources so the tools worker never fails on them
  - SEO hardening (P7): tokenized `/alerts/{verify,subscribed,unsubscribe}` pages now emit explicit `noIndex` metadata; canonical + absolute OG verified over HTTP on `/` and `/tools`
  - Worker alert signal (P9): `tests/ingestion/worker-exit.test.ts` spawns the real worker against the test DB and asserts exit 0 on success / exit 1 on failure

PARTIALLY IMPLEMENTED:
  - lib/env.ts (config + test isolation + write guard) — functional, more keys added in later phases
  - lib/db/db.ts pool/drizzle client — shared by app, scripts, and worker
  - AI enricher runs only for newly-created tools; detected updates are stored as draft `updates` rows for human review rather than auto-enriched
  - Live Gemini call unverified (no GEMINI_API_KEY locally) — provider implemented, scripted-provider tests cover the path
  - Admin server actions verified via service integration tests + page render; browser click-through deferred to the E2E phase
  - Public pages verified via HTTP status/cache-header/content/structured-data checks; no browser automation yet
  - Ad slots are resolved at render time, so on ISR/static pages the configured client/slot ids are baked in at build time — changing `ADSENSE_*` requires a rebuild (or a revalidation) to appear
  - Affiliate click tracking is rate limited per IP hash (30/60s default) but the limiter is in-process only — a multi-instance deployment needs a shared store
  - CSP is report-only (Next inline bootstrap + AdSense tags); nonce-based enforcement is deferred

NOT IMPLEMENTED:
  - in-repo scheduling (worker is run by external cron/Task Scheduler/K8s CronJob per OPERATIONS.md), analytics pipeline/aggregation, real ad/affiliate credentials, nonce-based CSP enforcement, browser-automation E2E

KNOWN BUGS:
  - none (277/277 tests passing); the pre-fix tools-worker failure on model sources (P3) was detected by a scheduled run, fixed in `runIngestion`, and is now guarded by a test AND verified sensor

KNOWN RISKS:
  - Gemini API key not supplied → worker runs ingestion-only and reports AI disabled (no fabrication)
  - Docker Desktop must be running for Postgres (win32 host)
  - npm audit reports 4 moderate advisories in dev toolchain (assessed: dev-only transitive deps, no production runtime exposure; no fix applied — see RISKS)
  - Vitest globalSetup process requires explicit NODE_ENV=test (handled + guarded)
  - `/tools` and `/search` are dynamic SSR (searchParams) and not CDN-cacheable — acceptable for filtered views; SEO landing pages are static
  - `NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000`; must be set to the real origin in production or canonical/sitemap/OG URLs will point at localhost
  - The public click tracker is unauthenticated and writes one row per request — rate limited per IP hash in-process (30/60s default); needs a shared store for multi-instance deployments
  - Dev seed contains a labelled demo sponsored campaign pointing at `example.com`; must not be seeded in production
  - The CSP is report-only until a nonce-based policy is implemented, so it currently only reports (no blocking) of violations

LAST TEST RESULTS:       vitest 277/277 passed / 37 files (db + ingestion + models + ai + auth + actions + services + seo + monetization + security + ops + ui + notifications + worker-exit)
LAST BUILD RESULT:       PASS — `next build` (Next.js 16.3.5, Turbopack) with zero warnings
LAST DATABASE VERIFICATION:  PASS — 26 tables, 3 migrations, all indexes incl. GIN trigram/tsvector, pg_trgm present; backup dump restored into a scratch DB (26 tables, exact row parity: tools 5, models 4, sources 4, runs 8, categories 4, collections 1)
LAST INGESTION VERIFICATION: PASS — worker run against aidiscovery_dev idempotent (duplicates on repeat); since P3 the tools worker runs tool sources only (never fails on `model:*`); hf adapter real fetch verified once (8 drafts, then dev DB reset); retry/backoff/429 timeouts covered by `tests/ingestion/http-retry.test.ts`
LAST SCHEDULING VERIFICATION: PASS — Windows Task Scheduler `AIDiscovery-IngestionTools`/`AIDiscovery-IngestionModels` on-demand dispatch: `LastTaskResult=0`, real worker `--json` logs, `ingestion_runs` rows persisted; worker-exit subprocess tests guard exit 0/1
LAST BACKUP VERIFICATION: PASS — `npm run db:backup` wrote `backups/backup-<ts>-aidiscovery_dev.dump` (~79 KiB) and pruned to retention; restore into a scratch DB confirmed 26 tables + row parity, then dropped
LAST UPDATE VERIFICATION: PASS — live over HTTP as an authenticated admin: draft update → POST publish → 303 + `updates.status=published` + `content_revisions` (`update.status`/`admin`), second draft → `rejected`; unauthorized POST rejected (307 → `/admin/login`) leaving the row `draft`; the published update rendered on the public tool page and the rejected one did not
LAST RUNS/OBSERVABILITY VERIFICATION: PASS — logged-in `/admin/runs` 200 with the metrics grid (fetched/created/updated/duplicates/invalid/errors/AI/duration)
LAST AI VERIFICATION:    PARTIAL — scripted-provider integration tests PASS; live Gemini call PENDING (no API key)
LAST AUTH VERIFICATION:  PASS — live: anon /admin 307 → /admin/login?callbackUrl, credentials login issues authjs.session-token, all admin pages 200, bad password rejected, missing tool 404
LAST PUBLIC VERIFICATION: PASS — live against the production build: `/`, `/tools`, `/search`, `/about`, `/contact`, `/privacy`, `/terms` 200; `/tools/<slug>`, `/categories/<slug>`, `/collections/<slug>`, `/categories`, `/collections` 200 with ISR cache HIT + expected s-maxage; missing tool/collection → 404; Arabic RTL markup and sample content rendered
LAST SEO VERIFICATION:   PASS — live against the production build: `/robots.txt` blocks /admin, /api/, /search and points to the absolute sitemap; `/sitemap.xml` 200 (prerendered, 1h) includes home, directory/landing pages and published tool/category/collection URLs with `<lastmod>`; tool detail emits `SoftwareApplication` + `BreadcrumbList` + `FAQPage` JSON-LD, canonical and `og:url`/`og:type`; home emits `WebSite` (with `SearchAction`) + `Organization`; filtered `/tools?q=…` canonicalizes to `/tools` and is `noindex, follow`; `/search` is `noindex`; unmatched URL renders the Arabic 404 page with `noindex, nofollow`; `/tools` canonical = `http://localhost:3000/tools` with absolute `og:title`/`og:url`; `/alerts/verify|subscribed|unsubscribe` are `noindex`
LAST MONETIZATION VERIFICATION: PASS — live against the production build: with `ADSENSE_*` empty no ad markup or script is emitted anywhere; with test ad ids set at build time the layout header slot and detail sidebar slot render with the configured client + `data-ad-slot` values and the AdSense loader while unset placements emit nothing; `/api/track/click?tool=sample-chat-assistant` 302s to the stored affiliate URL and persists a click (64-char salted IP hash, UA stored, no raw IP), unknown tool → 404, missing param → 400, non-http(s) destination → 404; demo campaign renders the labelled sponsored blocks on `/` and `/tools` and the "مُموَّل" badge + affiliate disclosure on the tool page; a tool without an affiliate URL keeps a direct outbound CTA
LAST SECURITY VERIFICATION: PASS — live against the production build: all baseline headers present on `/` (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, report-only CSP listing the AdSense origins) with HSTS added only in production; `X-Powered-By` absent; 32 rapid tracked requests from one IP → 30× `302` then `429`; `npm run smoke` 28/28 HTTP end-to-end checks pass; secret-exposure guards green in the suite
```

Edit this file only with verified facts. The repository and runtime behavior take precedence over this file.
