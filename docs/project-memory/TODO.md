# TODO

Priorities: P0 = Critical, P1 = High, P2 = Medium, P3 = Low.

## Phase 1 — Architecture (complete)
- [x] [A-01] P0 Project memory system bootstrap — docs/project-memory/
- [x] [A-02] P0 Environment toolchain verification (Node 24, Docker, npm registry)
- [x] [A-03] P1 ADR log (DECISIONS.md) covering stack/db/auth/ai/search decisions
- [x] [A-04] P0 Next.js + TS + Tailwind scaffold (create-next-app) & git init
- [x] [A-05] P1 Root configs: eslint, vitest, tsconfig aliases, .env.example, gitignore, docker-compose

## Phase 2 — Database (complete)
- [x] [D-01] P0 lib/db/schema.ts (all entities + constraints) + drizzle config
- [x] [D-02] P0 First migration (pg_trgm/tsvector ext, tables, indexes) — `0000_daily_tarantula.sql`
- [x] [D-03] P0 Docker Postgres 16 up (dev + test DBs)
- [x] [D-04] P0 seed script (categories, sample tools, default admin, curated collection) — idempotent
- [x] [D-05] P1 constraint/idempotency tests against test DB — 11/11 passing

## Phase 3 — Ingestion (complete, except update monitoring)
- [x] [I-01] P0 adapter base + RSS adapter + sample RSS fixture/feed
- [x] [I-02] P0 normalization (URL, name) + validation schemas
- [x] [I-03] P0 pipeline run (fetch→raw→normalize→validate→dedupe→store) idempotent
- [x] [I-04] P1 update-monitoring pass for existing tools → done in Phase 10 (content-hash change detection creates a draft `updates` row; admin review UI wired to `setUpdateStatus`)
- [x] [I-05] P1 ingestion tests (dedup, idempotency, error isolation, retries)

## Phase 4 — Gemini AI (complete, live call pending key)
- [x] [AI-01] P0 provider interface + Gemini impl + prompts
- [x] [AI-02] P0 Zod AI output schemas + fact validation + confidence/quality gate
- [x] [AI-03] P0 AI tests (valid/malformed/incomplete responses, hallucination guard)
- [x] [AI-04] P2 Arabic content engine quality rules + FAQ generation
- [ ] [AI-05] P1 Live Gemini verification (blocked: no GEMINI_API_KEY on this machine)

## Phase 5 — Backend/Admin (complete)
- [x] [B-01] P0 NextAuth admin auth + middleware guard
- [x] [B-02] P0 admin auth tests (deny/no-session, role checks)
- [x] [B-03] P0 admin tools CRUD + review workflow (approve/reject/archive/reprocess)
- [x] [B-04] P1 admin categories/tags/collections CRUD
- [x] [B-05] P1 admin sources + ingestion runs + errors views; "run now"
- [x] [B-06] P1 admin monetization (sponsored listings, affiliate URLs, featured)

## Phase 6 — Public frontend (complete)
- [x] [F-01] P0 layout (header/footer, RTL/AR) + responsive shell
- [x] [F-02] P0 homepage (featured, categories, latest tools, collections)
- [x] [F-03] P0 tool detail page (+ related, updates, FAQ, CTA)
- [x] [F-04] P0 category + collections pages (filters, pagination) — category/collection landings are static (ISR); paginated filtering lives on `/tools?category=…`
- [x] [F-05] P0 /tools directory + /search (filters)
- [x] [F-06] P2 static pages (about/contact/privacy/terms)

## Phase 7 — SEO (complete)
- [x] [S-01] P0 metadata + canonical + OG for tool/category/collection/search
- [x] [S-02] P0 sitemap.ts + robots.ts + 404
- [x] [S-03] P0 JSON-LD (SoftwareApplication/WebSite/Breadcrumb/FAQ)
- [x] [S-04] P1 internal linking (related tools/categories/collections)
- [x] [S-05] P1 SEO tests (canonical/metadata/sitemap/structured data)

## Phase 8 — Monetization
- [x] [M-01] P1 ad slot config (env-driven) + AdSlot component (header/in-content/sidebar/listings)
- [x] [M-02] P1 affiliate click tracking endpoint + disclosure
- [x] [M-03] P1 sponsored listings rendering (distinct from organic)

## Phase 9 — Testing & hardening
- [x] [T-01] P0 full test suite green (unit + integration)
- [x] [T-02] P0 tsc typecheck + eslint clean
- [x] [T-03] P0 production build PASS
- [x] [T-04] P1 security checks (headers, no-secrets-in-frontend, rate limiting)

## Phase 10 — Production readiness (complete)
- [x] [R-01] P1 .env.example completeness + README runtime/deploy instructions
- [x] [R-02] P1 worker scheduling + logging + backup strategy documentation (OPERATIONS.md, timestamped/`--json` worker logs, `npm run db:backup` with verified restore)
- [x] [R-03] P1 observability (run metrics verified in admin — `/admin/runs` metrics grid)
