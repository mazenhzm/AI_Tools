# PROJECT MEMORY — AI Tools Intelligence & Discovery Platform

- **Project name:** AI Tools Intelligence & Discovery Platform
- **Product vision:** Arabic-first AI tools discovery, intelligence and SEO platform. Continuously discovers tools/products, enriches with Google Gemini, validates facts, generates high-quality Arabic and English content, and publishes SEO-optimized pages. Pipeline: Discover → Normalize → Validate → Deduplicate → Enrich → Verify → Quality Gate → Publish → Monitor → Update.
- **Business objective:** Organic Google traffic + Google AdSense + affiliate links + featured/sponsored listings.
- **Target users:** Arabic-speaking entrepreneurs, developers, students, marketers, content creators, designers, business owners, researchers, general AI-curious users. Public site: no auth. Auth only for admins.
- **Core features:** Ingestion workers, Gemini enrichment, Arabic-first content engine, quality gate, admin review workflow, SEO pages (tools/categories/search), tool updates monitoring, monetization slots.

## Technology stack

- Frontend/Backend: Next.js (App Router, TypeScript, Tailwind CSS, Server Components first).
- Database: PostgreSQL 16 (Docker for local dev/test; provider-agnostic — Supabase/Neon deployable). Drizzle ORM + drizzle-kit migrations.
- AI: Google Gemini API via `@google/genai`, structured JSON output, Zod-schema validated before store.
- Ingestion worker: standalone Node.js/TypeScript worker sharing app schema/types (single-language decision, see DECISIONS.md).
- Auth: NextAuth (Auth.js v5) credentials + JWT, middleware-protected `/admin`.
- Search: PostgreSQL full-text (`tsvector`, `pg_trgm`); Elasticsearch only if scale later requires.
- Tests: Vitest (+ Testing Library for components), integration tests against test DB.
- Infra: Docker Compose (Postgres), `.env`-driven config, scripted migration/seed/worker commands.

## Architecture summary

```
External Sources (RSS / APIs / websites)
      → Discovery Layer (adapter-based sources/sources/*)
      → Normalization + Validation + Deduplication (idempotent)
      → Gemini AI Layer (structured JSON, Arabic/EN content, SEO)
      → Quality Gate (fact validation, confidence rules)
      → pending_review | publish
      → PostgreSQL
      → Next.js public pages + admin dashboard
```

## Database summary

Catalogues: `tools`, `categories`, `tags`, `features`, `updates`, `collections`, `sponsored_listings`.
Sources: `sources`, `tool_sources`, `ingestion_runs`, `ingestion_items`.
AI: `ai_processing_logs`.
Content: `content_revisions`.
Commerce: `affiliate_clicks`.
Analytics: `analytics_events` (basic).
Auth: `administrators`.
See DATABASE.md for full model. Constraints (FK, unique, check) enforced at DB level. Item uniqueness guaranteed by `(source_id, source_item_id)`; tool slug unique; domain+name normalization for dedup.

## AI strategy

Gemini is an enrichment engine, never the source of truth. Structured prompts demand JSON. Output validated via Zod. Enforced anti-hallucination rules in system prompt + independent app-level validation. Facts not present in source data → unknown/null. Confidence score drives auto-publish vs pending_review.

## Ingestion strategy

Adapter pattern: `ingestion/adapters/` defines `fetch → normalize → validate → return_items` for tools (`fixture:inline`, `rss:generic`, `http.ts` shared HTTP with retry/backoff) and `ingestion/models/` for models (`model:fixture`, `model:huggingface`). `runIngestion` (tools) excludes `model:*` sources; the tools worker and the models worker each run their own source family. Idempotent by `(source, source_item_id)` and normalized URL. Raw item stored before processing. One bad item never aborts a run; transient HTTP errors retry with backoff and respect 429/Retry-After.

## SEO strategy

Dynamic metadata, canonical, OG, sitemap.xml, robots.txt, JSON-LD (SoftwareApplication, WebSite, BreadcrumbList, FAQPage when factually justified), breadcrumbs, internal linking, clean slugs, 404 handling. Programmatic pages (collections) must be curated, never keyword-stuffed.

## Monetization strategy

Configurable ad slots (header/in-content/sidebar/between listings) via env-driven config, not hard-coded IDs. Affiliate URLs tracked alongside official URLs with click tracking + disclosure. Sponsored listings distinct from organic, with start/end date and placement.

## Security principles

No secrets in code/frontend; env-only. Input/output validation everywhere. Auth+authorization on admin. CSRF handled. XSS/SQLi protection via framework + parameterized queries. Never log secrets. Rate limiting on click tracking.

## Current implementation phase

Production readiness execution protocol (P0–P11). P0–P3, P7–P9 completed and
verified (see CHANGELOG 2026-09-22 and PROJECT_MAP.md at repo root). P4 (Gemini
live) BLOCKED-EXTERNAL — needs a real `GEMINI_API_KEY`. P5 (governance policy)
needs a product-owner decision. P6 (notifications real delivery) BLOCKED-EXTERNAL
— needs SMTP/telegram credentials.

## Current project status

Implemented and verified against a production build: Arabic-first public site,
admin dashboard + auth, adapter-based tools and models ingestion, AI enrichment
layer (ingestion-only until a real Gemini key is configured), quality gate,
SEO (sitemap/robots/metadata/JSON-LD), monetization (env-driven ads, affiliate
tracker with rate limiting, sponsored listings), update monitoring, worker
observability + scheduled execution on Windows Task Scheduler, backup/restore
drill. Suite: 277/277 tests, smoke 28/28, build clean. See PROJECT_MAP.md for
per-capability status (IMPLEMENTED / VERIFIED / PARTIAL / BLOCKED).

## Important constraints

- Accuracy over volume; no hallucinated facts; source-first.
- Every published page must meet quality threshold.
- All automation idempotent; safe retry; audit preserved.
- Arabic is first-class (natural MSA, not raw machine translation).
- 13. Rule: never trust docs over code/runtime.

## Important decisions

See DECISIONS.md (ADR log). High-level: single-language TS worker; Drizzle ORM; Auth.js; Gemini + Zod; PG full-text search; Docker Postgres on port 5433; collections entity for curated programmatic pages.

## Known limitations

- Gemini key is user-supplied env; AI pipeline tested with mocks until key present.
- Analytics are basic events, extensible later.
- E2E browser tests deferred to hardening phase; integration-level coverage prioritized.