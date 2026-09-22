# TEST STATUS — last verified

```text
UNIT TESTS:            PASS — pure unit cases (normalize, ai quality/provider/json/schemas/prompts,
                       auth authorization, seo metadata/json-ld, ads resolveAdSlot, security headers,
                       rate limiter, secret-exposure guards, backup selection, run-metric formatting,
                       ingestion timeout resolution + http retry/backoff, hf model adapter)
                       run green as part of the 277-test suite
INTEGRATION TESTS:     PASS — 277/277 total across 37 files (db schema, ingestion pipeline/rss/
                       update-monitor/runIngestion, model pipeline, ai enrich, services review/catalog/
                       monetization, action authz, seo sitemap/robots/alert-pages, monetization
                       tracking/sponsored/rate-limit, security secrets, ops backup, notifications,
                       worker exit-code subprocess; real Postgres)
E2E TESTS:             PASS — `npm run smoke` runs 28 HTTP checks against a running production build
                       (public routes, 404, robots/sitemap incl. models, admin 307 guard, tracker
                       400/404/302, security headers, no X-Powered-By); 28/28 green. Browser automation
                       still absent
WORKER EXIT SIGNAL:    PASS — `tests/ingestion/worker-exit.test.ts` spawns the real worker against the
                       test DB: exit 0 on success, exit 1 when a source fails (the scheduler alert
                       signal is now guarded)
TYPE CHECK:            PASS — `npm run typecheck` (tsc --noEmit) clean
LINT:                  PASS — `npm run lint` (eslint) clean
BUILD:                 PASS — `next build` (Next.js 16.3.5 / Turbopack), zero warnings
DATABASE CHECK:        PASS — migration applied; 26 tables, 3 migrations, pg_trgm present;
                       seeds idempotent (2x run, no duplicates)
INGESTION CHECK:       PASS — 8 pipeline cases (success, idempotency, invalid isolation, malformed
                       feed, network failure, cross-source URL dedupe, metrics) + runIngestion
                       (paces sources, excludes `model:` ones so the tools worker never fails);
                       live worker run against aidiscovery_dev is idempotent (duplicates on repeat)
                       and, since P3, no longer fails on model sources
AI PIPELINE CHECK:     PARTIAL — 29 cases (quality scoring/gate, strict schema rejections, lenient
                       JSON parsing, retry/backoff semantics, prompts, scripted-provider enrichment
                       incl. publish/hold/malformed/permanent-error). Live Gemini call PENDING
                       (no GEMINI_API_KEY); worker verified to report AI-disabled safely
AUTH CHECK:            PASS — live against the production build: anonymous /admin and /admin/tools
                       return 307 to /admin/login?callbackUrl=…; credentials login issues
                       `authjs.session-token`; dashboard/tools/categories/tags/collections/sources/
                       runs/monetization + tool & collection detail all return 200; wrong password
                       rejected (session empty); unknown tool id → 404
PUBLIC CHECK:          PASS — live against the production build: `/`, `/tools`, `/categories`,
                       `/collections`, `/about`, `/contact`, `/privacy`, `/terms` and
                       `/search?q=…` return 200; `/tools/sample-chat-assistant` and
                       `/tools/sample-image-generator` return 200 with `x-nextjs-cache: HIT` and
                       `s-maxage=3600`; `/categories/ai-chatbots` and
                       `/collections/sample-starter-collection` return 200 with `s-maxage=600`;
                       unknown tool and collection slugs → 404; Arabic RTL markup, FAQ, features,
                       tags, updates, related tools and category/collection listings rendered
SEO CHECK:             PASS — 17 SEO tests (metadata builder: canonical/OG/noindex/absolute title;
                       JSON-LD: Organization, WebSite+SearchAction, SoftwareApplication pricing→offers
                       incl. no fabricated ratings, BreadcrumbList positions, FAQ filtering, safe
                       serialization) + sitemap/robots integration against the test DB (published
                       included, drafts excluded, lastModified, disallow rules). Live-verified against
                       the production build: `/sitemap.xml`, `/robots.txt`, canonical + OG tags and
                       `SoftwareApplication`/`BreadcrumbList`/`FAQPage`/`WebSite` JSON-LD, filtered
                        views canonicalized + `noindex`, Arabic 404
MONETIZATION CHECK:    PASS — 16 tests (ad slot resolution incl. unconfigured → null; click tracker:
                       missing param 400, unknown/unpublished tool 404, non-http(s) destination 404,
                       302 to stored affiliate URL with a persisted click, salted IP hash and no raw
                       IP stored, website fallback; sponsored queries: active in-window only, placement
                       scoping, limit, active-lookup null cases). Live-verified against the production
                       build: no ad markup when `ADSENSE_*` empty and correct per-placement client/slot
                       + loader when set, tracker 302 + row inserted, labelled sponsored blocks and
                       "مُموَّل" badge + disclosure on the tool page
SECURITY CHECK:        PASS (hardening done; enforcement items listed in SECURITY.md) — 7 tests:
                       header set per environment (HSTS production-only, CSP limited to self + Google ad
                       origins, `*` never used) and secret-exposure guards (process.env only in the
                       centralized config allowlist, none in app/ or components/, client components never
                       import server-only modules, no sensitive `NEXT_PUBLIC_*` names). Live-verified:
                       baseline headers + report-only CSP on `/`, HSTS in production, no `X-Powered-By`,
                       tracker 429 after the per-IP budget, `npm run smoke` 28/28
BACKUP/RESTORE:        PASS — fresh `npm run db:backup` wrote a 79.2 KiB dump (retention pruned);
                       a scratch restore confirmed 26 tables and exact row-count parity with the live
                       dev DB (tools 5, models 4, sources 4, runs 8, categories 4, collections 1)
SCHEDULING:            PASS — verified Windows Task Scheduler tasks AIDiscovery-IngestionTools /
                       AIDiscovery-IngestionModels dispatch successfully (LastTaskResult 0, real
                       worker logs, `ingestion_runs` rows); must be registered with battery allowance
                       on laptops or stays Queued

```

## Verified test cases (tests/db/schema.test.ts)
- categories: unique slug (23505), self-FK valid, missing parent FK (23503)
- tools: defaults (draft / quality_score 0.00 / pricing unknown), unique slug, missing category FK, invalid enum (22P02)
- tools: cascade delete to tool_tags/tool_features/updates; category preserved
- tool_sources: composite unique (source_id, source_item_id) idempotency anchor (23505)
- updates: partial unique source_url (multiple NULL ok, duplicate URL rejected)
- search: tsvector expression query returns expected rows; trigram lower(name) LIKE query returns expected rows
- ids: random UUID PKs and bigserial analytics PKs

## Verified ingestion cases (tests/ingestion/*)
- rss: valid feed maps 3 items with stable ids/dates; empty feed returns []; malformed feed throws ParseError
- normalize: tracking params/www/fragment/trailing-slash stripped; invalid protocol rejected; arabic name preserved, slug stable
- pipeline: creates draft tools + tool_sources from fixture feed; re-run creates 0 / duplicates 3
- pipeline: invalid item isolated (2 created, 1 invalid, run completed); malformed feed fails run without items
- pipeline: network error fails run; existing tool with same website URL deduped (created 2, duplicates 1)
- pipeline: run metrics persisted and source last_fetched_at/last_success_at updated

## Verified AI cases (tests/ai/*)
- quality: full enrichment scores 90-100; weak scores < 50; warnings penalize; clamped to 0..100
- gate: publishes only on high score + confidence >= 0.7 + zero warnings; blocks otherwise
- schemas: rejects missing Arabic description, bad pricing enum, out-of-range confidence, non-objects
- json: parses plain/fenced/prose-wrapped JSON; rejects empty, non-JSON and malformed objects
- provider: retries transient (retryable) errors and succeeds; permanent errors not retried; attempt cap enforced
- prompts: system states anti-hallucination + Arabic-first rules; prompt embeds source text, categories, JSON template
- enrich (real Postgres): publishes 3/3 with taxonomy links + ai_create revisions + logs; malformed output stored
  nowhere and logged failed; unknown URL forces pending_review with warnings; permanent provider error marks all failed;
  model + promptVersion recorded in logs

## Verified auth/admin cases (tests/auth/*, tests/actions/*, tests/services/*)
- authorization: rejects null/malformed users and unknown roles; accepts admin/editor; enforces role list;
  normalizes missing email; requireAdmin blocks editors
- server actions: anonymous callers are redirected to /admin/login and make zero DB writes
  (status change, reprocess, source toggle, ingestion run)
- review: transition table is closed over the enum; valid transition writes status + revision; invalid
  transition refuses; publishedAt set on publish and cleared on un-publish; archiving is admin-only;
  self-transition is a no-op; field updates snapshot previous values; empty patch refused
- reprocess: requires auth; reports missing stored source data; re-enriches from `tool_sources.normalized_data`
- catalog: category create derives slug + revision, rejects missing names/duplicate slug, delete detaches
  tools (admin-only); tag create/delete duplicate + role rules; collection ordered curation ignores unknown
  ids and writes a revision; collection delete admin-only
- monetization: featured toggle (editor) + revision + idempotent no-op; affiliate URL admin-only with
  http(s) validation and null clearing; sponsored listing date/status validation, create/update/status +
  revisions; missing tool rejected

Rule: never mark PASS without actually running. Updated at end of each phase.

## Verified SEO cases (tests/seo/*)
- url helpers: origin normalization (no trailing slash), absolute url building for root and nested paths
- metadata: absolute canonical, `og:url`/`og:locale`/twitter card, absolute title for home, `noindex, follow` for filtered views, description fallback
- json-ld: Organization + WebSite nodes with `SearchAction` targeting `/search?q={search_term_string}`; SoftwareApplication maps free→price 0, freemium/paid→offer category, unknown→no offers; `aggregateRating` never emitted; breadcrumb positions ordered; empty FAQ entries dropped
- serialization: `<` escaped to `\u003c` (no script breakout) and arrays round-trip
- sitemap (test DB): static routes present; published tool/category/collection included; draft tool/collection excluded; `lastModified` attached to tool entries
- robots: allow-all with `/admin`, `/api/*`, `/search` disallowed; absolute sitemap url and host

## Verified monetization cases (tests/monetization/*)
- ads: `resolveAdSlot` returns null when the client or the placement slot is missing/empty, returns client+slot when both are set, trims whitespace, and every placement has a slot key
- tracking: 400 without `tool`; 404 for unknown and unpublished tools; 404 when the stored destination is not http(s); 302 to the stored affiliate URL with the click persisted (salted 64-char hash, UA and referrer stored, raw IP never stored); falls back to `websiteUrl` when no affiliate URL exists and still records the click
- sponsored: `listActiveSponsoredTools` returns only published tools with an `active` campaign in the requested placement inside its date window, excludes draft campaigns/expired windows/unpublished tools, scopes by placement and honours the limit; `getActiveSponsorship` returns the active campaign, null when none/expired/unknown id
- rate limit: `createRateLimiter` allows exactly `limit` hits per window, blocks with a `Retry-After` hint, resets after the window, tracks keys independently; the tracker returns `429` with `Retry-After` after the budget and stops persisting clicks

## Verified security cases (tests/security/*)
- headers: baseline set present in every environment (`nosniff`, `DENY`, referrer policy, permissions policy, COOP, report-only CSP); HSTS emitted only for production; CSP confines `default-src`/`object-src`/`frame-ancestors`/`form-action` and allows only the Google AdSense script/frame/connect origins, never `*`
- secrets: `process.env` appears only in the centralized config allowlist (never under `app/` or `components/`); no client component imports `lib/env`, `lib/db`, `lib/services`, `lib/ai`, `lib/auth`, the rate limiter or the headers module; `.env.example` exposes at least one `NEXT_PUBLIC_` variable and none whose name matches `SECRET|PASSWORD|TOKEN|PRIVATE|DATABASE_URL|API_KEY`

## Verified update-monitoring cases (tests/ingestion/update-monitor.test.ts)
- record: creates a draft `updates` row for a changed item; second identical record is idempotent (`exists`); a changed payload records once; blank/unknown inputs are `skipped`
- pipeline: a changed `contentHash` produces a draft update + `metrics.updated` + item status `updated` and re-baselines the stored hash; replaying the same content counts a duplicate and writes nothing; an unchanged item does not create an update
- latestToolUpdate: returns the newest update for a tool and null when none exists

## Verified ops cases (tests/ops/backup.test.ts)
- backupFileName: stable timestamped name including the database name; parseBackupTimestamp round-trips it
- selectExpiredBackups: keeps the newest `retention` files, returns the rest as expired, tolerates fewer files than the retention window

## Verified UI/helper cases (tests/ui/labels.test.ts)
- metricNumber: reads numeric metrics, returns null for missing/non-numeric values
- formatDurationMs: formats sub-second, second and minute durations and renders a placeholder for missing durations

## Verified admin update-review cases (tests/services/review.test.ts — setUpdateStatus)
- requires an authenticated actor (rejects null with AuthorizationError)
- reports a missing update instead of throwing
- publishes a detected update and records a `content_revisions` row with field `update.status`
- refuses an invalid transition and treats a same-status target as a no-op
- live E2E (production build, authenticated admin): draft → publish 303 + DB `published`, draft → reject, anonymous POST 307 to `/admin/login` with the row unchanged
