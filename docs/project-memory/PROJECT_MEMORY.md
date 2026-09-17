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

Adapter pattern: `ingestion/sources/base/` defines interface (`fetch → normalize → validate → return_items`). RSS, product_sources, official adapters. Idempotent by `(source, source_item_id)` and normalized URL. Raw item stored before processing. One bad item never aborts a run.

## SEO strategy

Dynamic metadata, canonical, OG, sitemap.xml, robots.txt, JSON-LD (SoftwareApplication, WebSite, BreadcrumbList, FAQPage when factually justified), breadcrumbs, internal linking, clean slugs, 404 handling. Programmatic pages (collections) must be curated, never keyword-stuffed.

## Monetization strategy

Configurable ad slots (header/in-content/sidebar/between listings) via env-driven config, not hard-coded IDs. Affiliate URLs tracked alongside official URLs with click tracking + disclosure. Sponsored listings distinct from organic, with start/end date and placement.

## Security principles

No secrets in code/frontend; env-only. Input/output validation everywhere. Auth+authorization on admin. CSRF handled. XSS/SQLi protection via framework + parameterized queries. Never log secrets. Rate limiting on click tracking.

## Current implementation phase

Phase 1 — Architecture (in progress).

## Current project status

Greenfield. Empty repo bootstrapped on this session: toolchain verified (Node 24, Docker, git). No application code yet.

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