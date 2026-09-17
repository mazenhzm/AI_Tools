# RISKS

| RISK | IMPACT | PROBABILITY | MITIGATION | STATUS |
|---|---|---|---|---|
| Gemini API key missing on this machine | AI live path untestable locally | High (no key yet) | Provider interface + scripted-provider tests; worker runs ingestion-only and reports AI disabled; documented env requirement (AI-05) | Active |
| Docker Desktop not running | DB unavailable; all DB work blocked | Medium | `db:up` script with clear error; portable SQL fallback documented | Active |
| Gemini JSON output malformed | Content corruption | Medium | responseSchema + Zod validation; item fails safe (retry, no store) | Mitigated by design |
| AI hallucinated facts published | Product trust destroyed | High | Anti-hallucination system prompt + independent fact validation + quality gate + human review path | Mitigated by design |
| Duplicate tools from varied sources | Poor UX, SEO dilution | Medium | `(source_id, source_item_id)` + domain/name dedup + unique constraints | Design in place (Phase 3) |
| Source feed format changes | Ingestion breakage | Medium | Adapter isolation, raw storage, error classification, per-run metrics | Design in place |
| Source rate limits / policy | Missing data | Medium | Rate-paced fetching, robots/ToS respect, adapter config | Design in place |
| PG full-text search limits at scale | Search relevance degrades | Low | Revisit external engine only when needed (ADR-005) | Accepted |
| Windows dev quirks (paths, child_process) | Friction | Medium | Cross-platform shell-agnostic scripts; npm scripts not shell-specific | Monitoring |
| SEO policy risk (pathological SEO) | Google demotion | Medium | Curated collections only; thin-page policy; no fabricated schema | Mitigated by design |
| Cookie/session security regressions | Admin compromise | Low | NextAuth-managed sessions, httpOnly/secure cookies, proxy hint + layout re-check, service-layer `requireActor` (ADR-014), tested anonymous-action rejection | Mitigated (Phase 5) |
| Admin mutation bypass (forged/expired cookie) | Unauthorized writes | Low | Proxy is advisory only; real authorization runs in the service layer against the DB session; actions tested with mocked null session | Mitigated (Phase 5) |
| Testing accidentally hits prod DB | Data corruption | High | DATABASE_URL isolation per env; tests require explicit test URL; guard in seed scripts | Mitigated (Phase 2): globalSetup forces NODE_ENV=test, refuses non-`_test` DBs, resets `drizzle`+`public` schemas |
| Drizzle-kit/index API mismatch | Migration generation fails | Medium | Indexes declared in pgTable callback (ADR-010); raw SQL only inside expressions; generate+migrate in scripts | Mitigated (Phase 2): migration generated + applied cleanly |
| npm audit advisories in dev toolchain | Unknown | Low | Triaged: 4 moderate advisories, all transitive in the dev/build toolchain (no production runtime dependency path); no upgrade performed to avoid version churn, revisit before launch; version-locked package.json + CI build gate | Assessed (accepted, Phase 10) |
| Dependency churn (Next/React) | Build breakage | Medium | Version-locked package.json; CI build gate | Active |
| Click tracker open to abuse (no rate limit/auth) | Spam rows in `affiliate_clicks`, minor DB growth | Medium | Destination resolved from DB (no open redirect); IP hashed, UA/referrer truncated; fixed-window per-IP-hash rate limit (30/60s default, `CLICK_RATE_LIMIT_MAX`/`_WINDOW_MS`) → 429 + `Retry-After`; shared-store limiter still needed for multi-instance | Mitigated (Phase 9) in-process |
| CSP still report-only | No enforcement of the policy; violations logged only | Medium | Policy is written and tested, ad origins scoped narrowly; nonce-based enforcement + report endpoint planned before launch (see SECURITY.md) | Active |
| Ad config baked into ISR/static pages at build time | Changing `ADSENSE_*` appears stale until rebuild/revalidate | Low | Documented in CURRENT_STATE; AdSense fills units client-side; rebuild or revalidate after changing ids | Accepted |
| Demo sponsored campaign in dev seed | Fake sponsored block if seeded to production | Low | Clearly labelled reference (`[SAMPLE] demo campaign`) pointing at `example.com`; seeds are dev/test only and use the write-target guard | Mitigated |
| Affiliate URL of an unpublished tool still linked | Traffic to unverified offers | Low | Tracker only accepts `published` tools; CTA renders only from the same published payload | Mitigated (Phase 8) |
| Update-monitoring noise (feeds rewriting markup without real change) | Spurious draft updates for reviewers | Medium | Change detection is a hash of normalized content; repeats re-baseline rather than re-record; updates stay `draft` until a human publishes them | Mitigated (Phase 10) |
| Backups depend on the local Docker container and `pg_dump` in-image | Unrecoverable data if backups are not scheduled/externalised | Medium | `npm run db:backup` writes timestamped dumps (refuses empty) and prunes to retention; verified restore documented in OPERATIONS.md; production must schedule it and store dumps off-host | Active |
