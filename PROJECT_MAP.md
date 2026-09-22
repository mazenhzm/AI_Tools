# PROJECT MAP — AI Tools Intelligence & Discovery Platform

Generated from the ACTUAL repository and runtime state (2026-09-22). Every
capability listed here is backed by code AND, where marked, by verified live
evidence. Unverified / blocked capabilities are explicitly labelled.

## Repository layout

| Path | Purpose | Status |
|---|---|---|
| `app/` | Next.js App Router application (public `(public)` group, secured `admin`, `api`) | IMPLEMENTED, verified (smoke 28/28 + admin flows) |
| `app/(public)/` | Arabic RTL public site: home, `/tools`, `/models`, `/categories`, `/collections`, `/search`, static pages, `/alerts/*` | IMPLEMENTED, verified |
| `app/(public)/alerts/{verify,subscribed,unsubscribe}` | Tokenized subscription-confirmation pages — emitted with explicit `noIndex` metadata (SEO hardening P7) | IMPLEMENTED, verified |
| `app/sitemap.ts` | Dynamic sitemap: static routes + published tools/categories/collections/models, absolute URLs, `lastModified`, static fallback on DB error | IMPLEMENTED, verified live over HTTP |
| `app/robots.ts` | allow all; disallow `/admin`, `/api/`, `/search`; absolute sitemap + host | IMPLEMENTED, verified live over HTTP |
| `components/` | `site/` (layout, cards, pagination, ad slots, affiliate disclosure, sponsorship) + `seo/json-ld.tsx` | IMPLEMENTED, verified |
| `ingestion/` | Base tool ingestion: adapters, types, errors, normalize, dedupe, pipeline, registry, run | IMPLEMENTED, verified (tests + live runs) |
| `ingestion/adapters/rss.ts` | RSS/Atom adapter (`rss:generic`) | IMPLEMENTED, tested |
| `ingestion/adapters/fixture.ts` | Offline fixture adapter (`fixture:inline`) | IMPLEMENTED, tested |
| `ingestion/adapters/hf-models.ts` | Hugging Face model adapter (`model:huggingface`) — keyless, downloads-sorted, gates private/gated/disabled, modalities from pipeline_tag | IMPLEMENTED, VERIFIED once live (8 drafts; dev DB then reset to canonical) |
| `ingestion/adapters/http.ts` | Shared HTTP client (`createHttpGet`) with timeout + exponential backoff + 429/Retry-After + 5xx/network retry (P2) | IMPLEMENTED, tested |
| `ingestion/pipeline.ts` | Tool ingestion pipeline (fetch→raw→normalize→validate→dedupe→store, transactional, isolated failures) | IMPLEMENTED, verified |
| `ingestion/models/` | Model ingestion: adapter, normalize, pipeline, registry, update-monitor | IMPLEMENTED, verified |
| `ingestion/models/registry.ts` | Registers `model:fixture` + `model:huggingface` | IMPLEMENTED, verified |
| `ingestion/timeout.ts` | `resolveTimeoutMs` / `sleepMs` — fixes NaN-timeout bug in both pipelines (P2) | IMPLEMENTED, tested |
| `ingestion/run.ts` | `runIngestion` orchestrator — excludes `model:*` sources so the tools worker never resolves them (P3 live-bug fix) | IMPLEMENTED, verified |
| `lib/seo/` | `site.ts` (origin/absoluteUrl), `metadata.ts` (`buildPageMetadata`: canonical+OG+twitter), `json-ld.ts` | IMPLEMENTED, tested + verified live |
| `lib/security/headers.ts` | `securityHeaders(isProduction)` + report-only CSP (self + Google ad origins); HSTS prod-only; `poweredByHeader` off | IMPLEMENTED, verified live |
| `lib/monetization/` | env-driven ad config, click-tracker rate limiter, sponsored listings | IMPLEMENTED, tested |
| `lib/monetization/rate-limit.ts` | Fixed-window limiter → `429` + `Retry-After` on tracker | IMPLEMENTED, tested |
| `lib/notifications/` | Email (SMTP, log fallback when no host) / Telegram providers, subscription service, trigger-on-published-update | PARTIAL: email/telegram send paths IMPLEMENTED+tested; LIVE delivery BLOCKED-EXTERNAL (no SMTP/telegram creds) |
| `lib/ai/` | Gemini provider abstraction, prompts, Zod schemas, fact-check, quality gate, enrichment | PARTIAL: ingestion-only path VERIFIED; Gemini live call BLOCKED-EXTERNAL (no `GEMINI_API_KEY`) |
| `lib/ops/backup.ts` | `pg_dump`-in-container backup, retention pruning, empty-file guard | IMPLEMENTED, VERIFIED (79.2 KiB dump + scratch restore 26 tables, row parity) |
| `lib/db/` | Drizzle schema (26 tables), migrations (3), connections, queries (public/admin/catalog/models), errors | IMPLEMENTED, verified (restore drill) |
| `scripts/` | `worker.ts` (tools), `worker-models.ts` (models), `seed.ts` (idempotent, marks sample data), `seed-admin.ts`, `migrate.ts`, `backup.ts`, `smoke.ts` | IMPLEMENTED, verified |
| `scripts/smoke.ts` | 28 HTTP end-to-end checks (public routes, 404, robots/sitemap, admin guard, tracker, headers) | VERIFIED 28/28 |
| `scripts/worker.ts` | Emits ISO/level/`--json` logs + terminal `run_summary`; exits non-zero if any source fails (alert signal) | IMPLEMENTED, verified + guarded by `tests/ingestion/worker-exit.test.ts` |
| `tests/` | 37 files, 277 tests (accesses test DB; subprocess tests run real workers) | VERIFIED 277/277 |
| `infra/pg-init/` | Postgres init (test DB creation) | IMPLEMENTED, verified |
| `docs/project-memory/` | ARCHITECTURE, DECISIONS (ADR), DATABASE, INGESTION, OPERATIONS, SECURITY, SEO, RISKS, TEST_STATUS, AI_PIPELINE, CHANGELOG, TODO, PROJECT_MEMORY, CURRENT_STATE | PARTIAL: reconciled through P7/P8/P9 + P3 OPERATIONS; PROJECT_MEMORY overview text predates P1–P3 features |
| `docker-compose.yml` | Postgres container on port 5433 | VERIFIED running (`aidiscovery-pg`) |

## Runtime configuration facts

- Dev DB: `postgresql://aidiscovery:aidiscovery_dev@localhost:5433/aidiscovery_dev`. Test DB: same host, `aidiscovery_test`. Container `aidiscovery-pg`.
- Dev DB canonical state after P1 cleanup: tools 5 (2 fixture drafts + 3 published fixtures), models 4, providers 2, sources 4 (active: `fixture:inline`, `model:fixture`; inactive: `rss:generic`, `model:huggingface`), collections 1.
- Deprecated/waived: no in-app scheduler (ADR-018 external scheduler). `INGESTION_CRON` default `0 */6 * * *` is documentation-only.
- Windows Task Scheduler (verified): `AIDiscovery-IngestionTools`, `AIDiscovery-IngestionModels` — daily 02:00, repeat 6h, wrappers under `C:\Users\OMG\AppData\Local\Temp\opencode\run-worker-{tools,models}.cmd`, need `AllowStartIfOnBatteries` (laptop) and interactive logon.

## Verified status (evidence)

| Capability | Status | Evidence |
|---|---|---|
| Build + production server | VERIFIED | `npm run build` zero warnings; prod server served routes |
| Full test suite | VERIFIED | 277/277 tests, 37 files |
| Smoke (HTTP E2E) | VERIFIED | 28/28 |
| Sitemap/robots/metadata | VERIFIED | live HTTP output checked (published-only, absolute URLs, canonical/OG absolute) |
| Security headers + HSTS | VERIFIED | live checks: nosniff/DENY/strict-origin/COOP/CSP-report-only, HSTS in prod, no X-Powered-By |
| Backup + restore drill | VERIFIED | fresh 79.2 KiB dump; scratch restore: 26 tables, exact row parity |
| Scheduled ingestion execution | VERIFIED | tasks `LastTaskResult=0`, real worker logs + `ingestion_runs` rows |
| Worker alert signal | VERIFIED + guarded | exit 0 success / exit 1 failure subprocess tests |
| Hugging Face real fetch | VERIFIED once | created 8 drafts (then dev DB reset); idempotency re-run: 0 created |
| Real-source idempotency | VERIFIED | repeated fixture runs: duplicates=2, created=0 |

## NOT verified / BLOCKED

- Gemini live AI enrichment — BLOCKED-EXTERNAL (no real `GEMINI_API_KEY`; path runs ingestion-only by design).
- Real SMTP / Telegram delivery — BLOCKED-EXTERNAL (no credentials); email provider falls back to written-log in dev.
- Product-owner governance policy (auto-publish vs review, source trust, rollback) — NOT DECIDED (STOP boundary).
- Production deployment on a remote origin (real `NEXT_PUBLIC_SITE_URL`, TLS under HSTS) — NOT VERIFIED (host-bound dev verification only).