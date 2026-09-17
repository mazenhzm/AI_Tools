# AI Tools Intelligence & Discovery Platform

Arabic-first (RTL) platform for discovering AI tools: an automated ingestion +
AI-enrichment pipeline feeds a curated public catalog with an SEO layer and a
secured admin review console. Built with Next.js 16 (App Router, Turbopack),
TypeScript, Tailwind CSS 4, PostgreSQL + Drizzle ORM and a standalone Node
ingestion worker that shares the same `lib/` code.

Project memory (architecture, decisions, state, tests, risks) lives in
`docs/project-memory/`. Read `CURRENT_STATE.md` and `DECISIONS.md` before making
structural changes.

## 1. Prerequisites

- Node.js 20+ and npm
- Docker Desktop (local PostgreSQL 16) — or any PostgreSQL 15+ instance
- Optional: a Google Gemini API key (`GEMINI_API_KEY`) for AI enrichment

## 2. First-time setup

```bash
npm install
cp .env.example .env.development     # fill in AUTH_SECRET, ADMIN_* and, if available, GEMINI_API_KEY
npm run db:up                        # start the Postgres container (port 5433)
npm run db:migrate                   # apply SQL migrations
npm run db:seed                      # taxonomy + sample tools (dev only)
npm run db:seed:admin                # create the admin user from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                          # http://localhost:3000
```

Environment files are selected by `NODE_ENV` (`lib/env.ts`): `.env.development`,
`.env.test`, `.env.production`; a shared `.env` is layered on top. Set
`DOTENV_FILE` to force a specific file (used by the production smoke run).
`DATABASE_URL_TEST` is the only database URL tests ever use.

## 3. Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm run start` | Production build / serve it |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Vitest suite (needs the test DB) |
| `npm run smoke` | HTTP end-to-end checks against a running server (`-- --url <origin>`) |
| `npm run worker` | One ingestion pass (`-- --source <id>`, `-- --max-items N`, `-- --json`) |
| `npm run db:up` / `db:down` | Start/stop the Docker Postgres |
| `npm run db:generate` / `db:migrate` | Drizzle migration generate / apply |
| `npm run db:seed` / `db:seed:admin` | Dev data / admin user (idempotent) |
| `npm run db:backup` | Dump the database into `backups/` and prune old dumps |

## 4. Runtime topology

- **Web app** (`next start`): public site under `/`, admin console under `/admin`
  (NextAuth v5 credentials + JWT). Indexable pages are prerendered with ISR;
  only filtered listings (`/tools`, `/search`) render per request.
- **Worker** (`npm run worker`): pulls active sources, dedupes, stores draft
  tools, optionally enriches them with Gemini and applies the deterministic
  quality gate (`AUTO_PUBLISH_MIN_SCORE`, confidence ≥ 0.7, zero warnings).
  Without `GEMINI_API_KEY` it runs ingestion-only and logs a warning — it never
  fabricates content.
- **Database**: PostgreSQL with full-text search (`pg_trgm` + tsvector).

Deployment, scheduling, logging, backup/restore and pre-launch checklists are in
`docs/project-memory/OPERATIONS.md`.

## 5. Production notes

- Set `NEXT_PUBLIC_SITE_URL` to the real origin, or canonical/sitemap/OG URLs
  will point at localhost.
- Provide a strong `AUTH_SECRET`; never reuse the development value.
- Configure real ad/affiliate credentials only if you want monetization active —
  with `ADSENSE_*` empty the site renders no ad markup at all. Ad ids are baked
  into prerendered pages, so rebuild (or revalidate) after changing them.
- `npm run smoke` is the fastest post-deploy verification: it checks routes,
  security headers, the admin guard, the SEO endpoints and the click tracker.
- Read `docs/project-memory/SECURITY.md` for the current posture and the
  outstanding hardening items (CSP enforcement, shared-store rate limiting).
