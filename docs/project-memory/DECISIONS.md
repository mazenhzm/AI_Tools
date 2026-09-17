# Architecture Decision Records

ADRs follow: DATE / DECISION / CONTEXT / OPTIONS CONSIDERED / SELECTED APPROACH / REASON / CONSEQUENCES.

---

## ADR-001 — Single-language TypeScript stack (Next.js + Node worker)

- DATE: 2026-09-17
- DECISION: Use TypeScript for the entire system, including the ingestion worker.
- CONTEXT: Master build prompt allows "Python or Node.js ingestion worker". A second language (Python) would duplicate normalization, validation, types, and DB access across two ecosystems.
- OPTIONS CONSIDERED: (a) Python worker + Node web, (b) Node/TS worker sharing app code, (c) all-in-one Next.js process.
- SELECTED APPROACH: (b) Standalone Node/TS worker in the same repo, importing `lib/db`, `lib/validation`, `ingestion/*`.
- REASON: Maximizes code reuse, single dependency graph, single type system, single test runner; the worker can still be deployed as a separate service/process.
- CONSEQUENCES: Worker and web must share package.json; scheduling via dedicated entrypoint (`npm run worker`), not inside Next.js.

## ADR-002 — Drizzle ORM with drizzle-kit SQL migrations

- DATE: 2026-09-17
- DECISION: Use Drizzle ORM + drizzle-kit for schema and migrations; plain PostgreSQL.
- CONTEXT: Need type-safe queries, auditable migrations, strict DB constraints, provider independence.
- OPTIONS CONSIDERED: node-pg-migrate, plain `pg` + hand-rolled runner, Prisma, Drizzle.
- SELECTED APPROACH: Drizzle. 
- REASON: TypeScript-first, lightweight, generates plain SQL migrations, full control of constraints/indexes/checks, no codegen server dependency.
- CONSEQUENCES: Raw SQL available in migrations; schema defined in `lib/db/schema.ts` is the single source of truth.

## ADR-003 — Auth.js (NextAuth v5) credentials provider, JWT sessions

- DATE: 2026-09-17
- DECISION: Single-admin authentication via NextAuth v5 credentials + bcrypt password hash + JWT session cookie; middleware guards `/admin`.
- CONTEXT: Admin-only auth; must not be weakened for convenience; CSRF protection required for admin mutations.
- OPTIONS CONSIDERED: Hand-rolled iron-session + manual CSRF; Auth.js with database session store; Clerk (external).
- SELECTED APPROACH: NextAuth credentials + JWT (stateless). CSRF handled by framework, session `httpOnly` + `secure` in prod.
- REASON: Battle-tested session/CSRF handling; sufficient for one admin role; no third-party dependency.
- CONSEQUENCES: Session invalidation = manual (password/key rotation); documented in SECURITY notes.

## ADR-004 — Google Gemini with forced structured JSON + Zod validation

- DATE: 2026-09-17
- DECISION: Gemini (`@google/genai`) called with an explicit JSON response schema; every response parsed and validated by Zod before persisting.
- CONTEXT: Master prompt mandates structured JSON output and schema validation; hallucination guard is a hard requirement.
- OPTIONS CONSIDERED: Free-text responses + lenient parsing; Gemini `responseSchema` enforcement + Zod; multiple AI providers.
- SELECTED APPROACH: `responseSchema` JSON mode + Zod schema shared with DB writes.
- REASON: Eliminates arbitrary-responses-from-prompt risk; validates fields, enums, and unwritten-facts rules consistently app- and DB-side.
- CONSEQUENCES: AI layer is swapped by replacing one provider wrapper; tests use a fake provider returning valid/invalid payloads.

## ADR-005 — PostgreSQL full-text search (pg_trgm + tsvector), no external search engine

- DATE: 2026-09-17
- DECISION: Search implemented with PostgreSQL FTS and trigram indexes over name/description/category/tags/features.
- CONTEXT: Search across directory; master prompt says don't introduce Elasticsearch/OpenSearch unless scale requires.
- OPTIONS CONSIDERED: PG FTS, OpenSearch, Meilisearch.
- SELECTED APPROACH: PG FTS + trigram, targeted FILTERs (pricing/category/featured/newest).
- REASON: Zero extra infra, transactional consistency with the directory, sufficient for target scale.
- CONSEQUENCES: Revisit when index/search latency or feature needs (fuzzy, relevance tuning) exceed PG.

## ADR-006 — Local database via Docker Compose (Postgres 16) on port 5433

- DATE: 2026-09-17
- DECISION: Postgres 16.4-alpine container for dev and test; dev DB `aidiscovery_dev`, test DB `aidiscovery_test`.
- CONTEXT: No local Postgres on this Windows host; Docker available. Provider-agnostic schema for Supabase/Neon in prod.
- OPTIONS CONSIDERED: Local install, Supabase local CLI, Docker Compose.
- SELECTED APPROACH: Docker Compose `db` service, port 5433 (host) to avoid collision with any system Postgres.
- REASON: Reproducible across machines; tests isolated from production; DB image version-locked.
- CONSEQUENCES: Docker Desktop must be running; `make db-up` equivalent via npm script.

## ADR-007 — `collections` entity for curated programmatic-SEO pages

- DATE: 2026-09-17
- DECISION: Add a `collections` + `collection_tools` entity for curated pages ("Best AI Writing Tools" …) with admin curation.
- CONTEXT: Programmatic SEO pages must provide meaningful curated value, not thin autogen. Category pages alone don't cover intent lists.
- OPTIONS CONSIDERED: Static hand-written pages; categories-as-collections; DB-backed collections entity.
- SELECTED APPROACH: DB-backed collections (title/desc AR+EN, slug, SEO, curated tool list with position).
- REASON: Curated + editable, avoid thin/spammy pages, supports internal linking and monetization placements.
- CONSEQUENCES: Extra admin CRUD surface; pages index only when curated and non-empty.

## ADR-008 — One ingestion worker process; adapters for sources; idempotent by design

- DATE: 2026-09-17
- DECISION: Ingestion runs as a cron-driven worker process using an adapter architecture; dedup on `(source_id, source_item_id)` plus normalized URL/name signals; raw items stored before processing.
- CONTEXT: Master prompt requires source-adapter architecture, raw data preservation, dedup beyond name, idempotency.
- OPTIONS CONSIDERED: Single giant script (rejected), adapter-per-source (selected), per-source DB tables.
- SELECTED APPROACH: Adapters under `ingestion/sources/`; pipeline stages isolated; per-run `ingestion_runs` + per-item `ingestion_items` records.
- REASON: Extensible, auditable, restartable; one failing item is isolated; reruns are safe.
- CONSEQUENCES: Worker binary separate from Next.js; must be invoked in prod scheduler and locally via npm script.

## ADR-009 — Server-first rendering with ISR; minimal client JS

- DATE: 2026-09-17
- DECISION: Public pages are Server Components with static generation/ISR where appropriate; client components limited to search/filter controls and admin interactivity.
- CONTEXT: Core Web Vitals + SEO are product requirements.
- OPTIONS CONSIDERED: Full CSR/SPA, hybrid SSR, SSG+ISR hybrid.
- SELECTED APPROACH: SSG/ISR for tool/category/collection pages; SSR for search; tiny client islands.
- REASON: Fast TTFB, indexable HTML, low hydration cost.
- CONSEQUENCES: Revalidation triggers on publish/update; caching layer needed for correctness after content changes.

## ADR-010 — Drizzle indexes declared inside the `pgTable` extraConfig callback

- DATE: 2026-09-17
- DECISION: All indexes (including GIN trigram/tsvector expression indexes) are declared in the third `pgTable(name, columns, (t) => [...])` callback, referenced as `t.column`; raw SQL is used only for expression bodies.
- CONTEXT: Declaring `uniqueIndex(...).on(table.slug)` outside the table resolves columns to plain `PgColumn`s that lack `defaultConfig`; drizzle-kit then crashes with `SyntaxError: "undefined" is not valid JSON` at import time.
- OPTIONS CONSIDERED: keep external indexes and patch drizzle; move indexes into the callback (selected); hand-write indexes in SQL migrations (rejected — drift from schema).
- SELECTED APPROACH: Callback form `(t) => [uniqueIndex("...").on(t.slug), index("...").using("gin", sql\`...\`)]`.
- REASON: Canonical drizzle 0.45 API; generates correct SQL for partial + GIN indexes; keeps schema as single source of truth.
- CONSEQUENCES: Self-referencing FK needs `(): AnyPgColumn =>` to break circular type inference; ESLint warns on unused `t` when a column callback does not use it (fixed by using `()` in those callbacks).

## ADR-011 — Shared DB module is not marked `server-only`

- DATE: 2026-09-17
- DECISION: `lib/db/db.ts` configures a `pg.Pool` + drizzle client without `import "server-only"`.
- CONTEXT: The ingestion worker and `scripts/*` run under `tsx`/Node; `server-only` throws outside a React Server Component context, which would make the shared data layer unusable by the worker.
- OPTIONS CONSIDERED: keep `server-only` and duplicate the DB module for scripts (rejected); remove it and guard usage in server entry points (selected).
- REASON: Enables the single TS codebase/worker sharing decision (ADR-001) with one DB client implementation.
- CONSEQUENCES: Server-only enforcement must be applied deliberately in route handlers/server actions; client bundles must never import `lib/db` (next build will still fail if they do, since `pg` is Node-only).

## ADR-012 — Test database isolation is structural, not conventional

- DATE: 2026-09-17
- DECISION: Tests may only ever touch a database whose name ends in `_test`; the vitest global setup forces `NODE_ENV=test`, asserts the target URL, resets `drizzle` + `public` schemas, and re-applies migrations.
- CONTEXT: vitest does not set `NODE_ENV=test` in the globalSetup process; `lib/env.ts` only falls back to a test URL under `NODE_ENV=test`. A silent failure could otherwise wipe the development database.
- OPTIONS CONSIDERED: rely on env convention (rejected — it already failed once and reset dev); assert-and-guard (selected).
- REASON: Makes cross-database accidents impossible by construction; `DROP SCHEMA public` alone is insufficient because drizzle's ledger lives in the `drizzle` schema.
- CONSEQUENCES: Tests get a deterministic, freshly-migrated schema each run; `tests/db/schema.test.ts` truncates all tables between tests.

## ADR-013 - AI provider abstraction, strict contract, deterministic quality gate

- DATE: 2026-09-17
- DECISION: All AI enrichment goes through an `AiProvider` interface (`generateJson`), the model output is parsed leniently (`parseJsonFromModel`) but validated strictly (`aiEnrichmentSchema`), facts are cross-checked (`checkEnrichmentFacts`), and publication is decided by a pure deterministic scorer (`scoreEnrichment` + `decidePublication`) - never by the model itself.
- CONTEXT: AI output is untrusted input: it can be malformed JSON, omit fields, reference invented URLs, or be confidently wrong. The product must never publish fabricated facts.
- OPTIONS CONSIDERED: store raw model text and clean later (rejected); Zod-only validation (insufficient - cannot catch invented URLs); Zod + independent checks + scoring + human review for anything imperfect (selected).
- SELECTED APPROACH: `lib/ai/{provider,json,schemas,prompts,fact-check,quality,enrich}.ts`. Gemini is the only live provider; tests inject scripted providers. Any warning, score < `AUTO_PUBLISH_MIN_SCORE` (default 80), or confidence < 0.7 routes the tool to `pending_review`. Every attempt (success or failure) writes an `ai_processing_logs` row.
- REASON: Fail-safe by construction: nothing generated by a model reaches the public site without passing deterministic, testable gates; the model is never the judge of its own work.
- CONSEQUENCES: Without `GEMINI_API_KEY` the worker runs ingestion-only and reports AI as disabled (never fabricates); responseSchema is deferred in favour of `responseMimeType: application/json` + prompt template + Zod, which is provider-schema-feature independent; `AI_PROMPT_VERSION` must be bumped when prompts change.

## ADR-014 - Layered admin authz: proxy hint, session choke point, service layer, thin actions

- DATE: 2026-09-17
- DECISION: Admin protection is layered: (1) `proxy.ts` performs an *optimistic*, edge-safe session-cookie presence check and redirects to `/admin/login?callbackUrl=…`; (2) the admin route-group layout re-checks the real session with `auth()` and redirects; (3) every mutation goes through a testable service in `lib/services/*` that calls `requireActor`/`requireAdmin` as the single authorization choke point; (4) `lib/actions/*` server actions only do `auth()` -> service -> `revalidatePath` -> `redirect`.
- CONTEXT: Next.js proxy/middleware runs on every matched request but cannot safely run DB-backed auth or Node-only code; relying on it alone would be both unsafe (cookie can be forged/expired) and non-authoritative. Business logic mixed into server actions is hard to unit-test against the database.
- OPTIONS CONSIDERED: proxy-only guard (rejected - no real verification, no per-role rules); guard inside each action (rejected - easy to forget, duplicated); service-layer choke point + proxy UX hint + layout defense-in-depth (selected).
- SELECTED APPROACH: `lib/auth/authorization.ts` (`AuthorizationError`, `requireActor`, `requireAdmin`) is called by services; actions catch `AuthorizationError` and redirect to login; `proxy.ts` only redirects unauthenticated browsers for UX and never trusts the cookie for authorization.
- REASON: Authorization is enforced where the data is touched, so it cannot be bypassed by crafting a request, and it remains unit/integration testable without a browser. Archiving tools, deleting categories/tags/collections and all monetization writes are admin-only.
- CONSEQUENCES: A stale/invalid cookie still reaches the layout, which redirects (no data leak); new mutations must be implemented as services to inherit the checks; E2E/browser click-through tests remain a later-phase goal while service integration tests cover the logic today.

---

## ADR-015 — SEO: static/ISR landing pages, absolute canonical URLs, structured data from stored facts only

- DATE: 2026-09-17
- DECISION: All indexable pages are prerendered with ISR via `generateStaticParams`, SEO metadata is centralized in `lib/seo/*` (`buildPageMetadata`, `absoluteUrl`), structured data comes from `lib/seo/json-ld.ts` pure builders rendered through one `JsonLd` component, and `sitemap.ts`/`robots.ts` are route conventions.
- CONTEXT: Next.js 16 only revalidates dynamic-segment routes at runtime when they export `generateStaticParams` (an empty array is enough); otherwise they render dynamically with `Cache-Control: no-store`. Detail routes that read `searchParams` (pagination/filters) cannot be prerendered at all. SEO correctness also requires canonical URLs, avoiding duplicate-content indexing of filtered views, and never emitting data we do not actually store (e.g. ratings).
- OPTIONS CONSIDERED: (a) leave detail routes dynamic and rely on SSR; (b) prerender the full published set at build time with no fallback (build fails without a DB); (c) prerender the published set and fall back to on-demand rendering + static-only sitemap if the DB is unavailable at build time (selected).
- SELECTED APPROACH: `generateStaticParams` returns every published slug (tools/categories/collections) wrapped in try/catch that logs and returns `[]` so a DB-less build still succeeds; filtered/list views (`/tools`, `/search`) stay dynamic and are marked `noindex` (with canonical `/tools`); metadata is built by `buildPageMetadata`; JSON-LD maps the stored `pricingType` to schema.org `offers` and emits no `aggregateRating`; breadcrumbs/FAQ are generated from stored fields; `<` is escaped when serializing JSON-LD.
- REASON: Gives crawlers stable, cacheable HTML for every landing page, keeps builds resilient, prevents filtered/search URLs from competing in the index, and guarantees structured data never asserts facts the database does not contain.
- CONSEQUENCES: New published tools become available to crawlers on first request (then cached) or at the next build; `revalidate` inside `generateStaticParams` routes does not run the function again during ISR, so slug lists are refreshed by a rebuild or by on-demand revalidation in the admin flow; `NEXT_PUBLIC_SITE_URL` must be set correctly in production because canonical/sitemap/OG URLs are absolute.

---

## ADR-016 — Monetization: config-gated ads, DB-resolved affiliate redirects, sponsored placements labelled as paid

- DATE: 2026-09-17
- DECISION: Monetization is entirely configuration-gated and never fabricates inventory. (1) Ad units are resolved from env (`ADSENSE_CLIENT` + one slot id per placement) at render time in a server `AdSlot`; if either value is missing the component renders nothing. (2) Affiliate clicks go through `GET /api/track/click?tool=<slug>`, which resolves the destination from the database (published tools only, `http(s)` only) before recording the click and 302-ing — the redirect target never comes from the request. (3) Sponsored placements are rows in `sponsored_listings` with a free-text `placement` and a date window, surfaced through `listActiveSponsoredTools`/`getActiveSponsorship` and always rendered in a visually distinct, explicitly labelled "paid content" block or badge.
- CONTEXT: Ads and affiliate links must be switchable per environment without code changes; a naive `?url=` redirect endpoint is a classic open-redirect vulnerability; and sponsored content that is indistinguishable from organic results harms user trust and risks search-engine penalties. The schema also has no `targetUrl` column on `affiliate_clicks`, so the destination has to be resolved from the tool record.
- OPTIONS CONSIDERED: (a) hardcode ad ids in components — rejected (per-environment config, secrets in source); (b) render placeholder ad boxes when unconfigured — rejected (fake inventory, layout shift, no real value); (c) accept the redirect target from the query string — rejected (open redirect); (d) render sponsored tools inside the organic grid unlabelled — rejected (trust/SEO risk); (e) selected: env-resolved slots, DB-resolved redirects, separated labelled placements.
- SELECTED APPROACH: `lib/monetization/ads.ts` exports `resolveAdSlot`/`adConfigFromEnv`/`getAdSlot` and `components/site/ad-slot.tsx` renders the labelled unit + AdSense loader only when configured (header slot in the public layout, in-content on home, sidebar on tool detail, listings on `/tools`). The tracker hashes the client IP with `hashIp(ip, authSecret)` (salted SHA-256, no raw IP), stores truncated UA/referrer, and rejects unknown/unpublished tools with 404 and non-http(s) destinations with 404. Tool CTAs for affiliate tools link to the tracker and show `components/site/affiliate-disclosure.tsx`; sponsored blocks are labelled "أدوات مُموَّلة / محتوى مدفوع" and the tool page shows a "مُموَّل" badge for active campaigns.
- REASON: Keeps monetization off by default and truthful when on, removes the open-redirect class of bug entirely, stores no PII beyond a salted hash, and keeps paid placements clearly separated from editorial results.
- CONSEQUENCES: Ad ids are baked into prerendered/ISR HTML at build time, so changing `ADSENSE_*` requires a rebuild or revalidation (AdSense still fills the unit client-side); the tracker is unauthenticated and needs rate limiting before real traffic (Phase 9); dev seeds include a labelled demo campaign pointing at `example.com` and must not be seeded to production; when ads are configured, a `next/script` AdSense loader is included in the affected pages' HTML.

---

## ADR-017 — Security hardening: config-level headers, in-process limiter, test-enforced secret boundaries

- DATE: 2026-09-17
- DECISION: Baseline response hardening is declared once in `next.config.ts` via a pure, tested `securityHeaders()` helper (with a report-only CSP that whitelists only self plus AdSense origins, HSTS in production only, `X-Powered-By` disabled). The public click tracker is protected by a dependency-free fixed-window rate limiter keyed by the same salted IP hash used for storage, returning `429` + `Retry-After`. Environment/secret boundaries are enforced by tests rather than convention: `process.env` may only be read in the centralized config allowlist, nothing under `app/`/`components/` may read env, client components may not import server-only modules, and no sensitive `NEXT_PUBLIC_*` name may exist. E2E coverage is an HTTP smoke runner (`npm run smoke`) instead of browser automation.
- CONTEXT: The app had no security headers, the only public write endpoint was unauthenticated and unthrottled, and nothing structurally prevented a future client component from importing `lib/env` or a server-only module (the main architectural path to leaking `AUTH_SECRET` or `GEMINI_API_KEY`). A CSP with `script-src 'unsafe-inline'` is required by Next's streaming bootstrap and ad tags, so a strict enforced policy would break the site without nonce propagation. No browser-automation tooling is installed, and the valuable checks (status codes, headers, redirects, guards) are all observable over HTTP.
- OPTIONS CONSIDERED: (a) `proxy.ts` middleware for headers — rejected in favour of `next.config.ts` `headers()` which also covers static assets without running edge code; (b) enforce a CSP immediately with `unsafe-inline` — rejected because enforcement adds breakage risk without security benefit; (c) add Playwright for E2E — deferred (heavy dependency, needed only once real interaction flows exist); (d) rely on code review for secret boundaries — rejected (regressions are silent); (e) selected: config headers + report-only CSP, in-process limiter, test-enforced secret boundaries, HTTP smoke suite.
- REASON: Gives real protection now (clickjacking, MIME sniffing, referrer leakage, infrastructure fingerprinting), removes the trivial abuse path on the only public write endpoint, makes the most dangerous class of future regression (server secret reaching the client bundle) fail the test suite instead of shipping, and produces repeatable E2E evidence without a browser toolchain.
- CONSEQUENCES: The rate limiter is per-process, so a multi-instance deployment needs a shared store (documented in `SECURITY.md` and RISKS); the CSP is report-only and must be enforced with nonces before launch; header changes now require touching `lib/security/headers.ts` (covered by tests); the smoke script depends on a running server and is therefore not part of `npm test`.

---

## ADR-018 — Update monitoring as human-reviewed drafts; ops via external scheduler, structured worker logs and verified dumps

- DATE: 2026-09-17
- DECISION: Detecting that a known source item changed records a **draft** `updates` row for human review instead of mutating the published tool or auto-enriching it, and the review decision reuses the existing `contentStatus` state machine through `setUpdateStatus`. Operationally, scheduling stays **outside** the app (the worker is a CLI run by cron / Windows Task Scheduler / a K8s CronJob), the worker logs machine-readable structured events, and backups are timestamped `pg_dump` files with retention and a documented restore.
- CONTEXT: Phase 10 needs existing tools to stay fresh without letting a changed remote feed silently rewrite published Arabic content. The worker also has to be observable in unattended runs, and data must be recoverable. The schema already had an `updates` table and a `content_status` enum, and business logic belongs in the service layer (ADR-014).
- OPTIONS CONSIDERED: (a) auto-update the published tool when the source changes — rejected (unreviewed content, trust/SEO risk); (b) auto re-enrich via Gemini on change — rejected (cost, unverified model output); (c) record a draft update and add an admin review section — selected; (d) embed a scheduler (node-cron) in the web process — rejected (couples scheduling to the web dyno, duplicates under multiple instances); (e) rely on ad-hoc `pg_dump` commands — rejected (no retention/verification).
- SELECTED APPROACH: `ingestion/update-monitor.ts` (`recordToolUpdate`/`latestToolUpdate`) is invoked from the pipeline when the stored `contentHash` differs from the incoming one; the run increments `updated`, the ingestion item is marked `updated` (new `item_status` value) and the hash is re-baselined so replays dedupe. Draft updates surface in `getToolForAdmin` and the tool detail page; `setUpdateStatus` enforces `UPDATE_STATUS_TRANSITIONS` and writes a `content_revisions` row (field `update.status`). `scripts/worker.ts` emits ISO-timestamped `INFO/WARN/ERROR` events (or JSON lines with `--json`) and a `run_summary`, exiting non-zero on source failure. `lib/ops/backup.ts` + `scripts/backup.ts` (`npm run db:backup`) dump the DB inside the container into `backups/`, refuse empty dumps and prune to `BACKUP_RETENTION`; `OPERATIONS.md` documents scheduling, logging, backup/restore and the launch checklist.
- REASON: Keeps humans in control of published Arabic content while still tracking source changes, reuses one reviewed state machine and one service choke point, makes unattended runs diagnosable from logs/`/admin/runs`, and provides a tested, repeatable recovery path.
- CONSEQUENCES: Nothing reaches the public site from a detected change until an authorized admin publishes it; the public detail page only shows `published` updates; the changed hash is consumed even if a reviewer later rejects the update (a further remote change is required to re-trigger); scheduling and off-host backup storage remain deployment responsibilities, not application features.
