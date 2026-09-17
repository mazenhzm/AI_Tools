# ARCHITECTURE

## Application architecture

Monorepo-less single package: Next.js application + standalone Node/TS ingestion worker + shared libraries. All code is TypeScript. Web and worker read the same shared modules (`lib/db`, `lib/ai`, `lib/validation`, `ingestion/*`).

```
F:\AI Tools Intelligence and Discovery Platform
├── app/                 Next.js App Router (public + admin + API routes)
├── components/          React components (ui, layout, tool, category, admin)
├── lib/                 shared libraries (db, ai, seo, search, validation, monetization, auth, utils)
├── ingestion/           worker code (sources/*, pipeline/*, normalization, deduplication, validation, worker.ts)
├── scripts/             CLI scripts (migrations, seeds, admin user, ingestion runs)
├── tests/               test suites (unit + integration)
├── docs/project-memory/ project memory (authoritative state)
```

## Frontend architecture

- Server Components first; public pages SSG/ISR via `revalidate` time or on-demand revalidation.
- Client components only for: search box, filter controls, disclosure/banners, admin interactive tables.
- Route structure:
  - `/` home
  - `/tools` directory
  - `/categories` / `/category/[slug]` / `/tool/[slug]` / `/search`
  - `/collections/[slug]` curated programmatic-SEO pages
  - `/updates/...` tool update news lists
  - `/about`, `/contact`, `/privacy`, `/terms`
  - `/admin/**` protected area
- Tailwind CSS utility-first styling, accessibility-focused markup.

## Backend architecture

- Server actions / route handlers in `app/**` for mutations (admin CRUD, click tracking).
- Server Components query DB directly via shared `lib/db` (server-only module).
- No ORM leakage into components: `lib/db/queries/*` encapsulate reads.

## Database architecture

- PostgreSQL 16, Drizzle ORM schema in `lib/db/schema.ts`, migrations in `lib/db/migrations/`.
- Normalized model (see DATABASE.md). Constraints at DB layer (unique, FK, check).
- Dev: `aidiscovery_dev`, Test: `aidiscovery_test` (both on Docker `db` container, port 5433).
- Production: any plain-Postgres provider (Supabase/Neon/RDS).

## Ingestion architecture

- `ingestion/worker.ts` — cron loop / on-demand runs.
- `ingestion/pipeline/` — stages: fetch → raw store → normalize → validate → dedupe → enrich(AI) → fact-validate → quality → decision.
- `ingestion/sources/base/adapter.ts` — `SourceAdapter` interface; concrete adapters under `rss/`, `product_sources/`, `official/`.
- Idempotent: `(source_id, source_item_id)` unique; UPSERT semantics.
- Errors isolated per item; run status + metrics recorded in `ingestion_runs`.

## AI architecture

- `lib/ai/provider.ts` — Gemini wrapper (interface so tests can fake it).
- `lib/ai/prompts.ts` — system/instruction templates enforcing anti-hallucination rules.
- `lib/ai/schemas.ts` — Zod schemas for AI JSON output (and item schemas).
- `lib/ai/quality.ts` — confidence scoring + quality gate rules.
- Pipeline stores validated AI output + warnings; failures logged to `ai_processing_logs`.

## SEO architecture

- `lib/seo/` — metadata builders, JSON-LD builders, canonical/sitemap helpers.
- `app/sitemap.ts`, `app/robots.ts`.
- JSON-LD: SoftwareApplication (tools), WebSite (site), BreadcrumbList, FAQPage (only when genuine FAQ exists).
- Internal linking modules generate related tools / related categories / collection cross-links.

## Authentication & authorization

- NextAuth v5 credentials (admin email/password) → JWT session.
- `middleware.ts` guards `/admin/*` (session + role claim check).
- Admin mutations re-check auth server-side (never trust the client).
- Rate limiting on public click-tracking + login endpoints.

## External integrations

- Google Gemini (`GEMINI_API_KEY`) — enrichment/content.
- AdSense (env-driven) — ad slot config.
- Affiliate networks — affiliate URL per tool + click tracking.
- Source feeds — RSS/APIs aligned to `sources` table; robots/rate-limit aware.

## Deployment architecture

- Web: Next.js standalone server (ISR). Worker: long-running process scheduled by platform cron.
- Postgres: managed provider. Env-driven via `.env.production`.
- Documented in docs/project-memory and README (Phase 10).