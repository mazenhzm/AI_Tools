# SECURITY

Security posture of the platform as of Phase 9, and the work still outstanding
before a public production launch.

## Authentication & authorization
- Admin authentication is NextAuth v5 (Auth.js) with the credentials provider, bcrypt password hashes and JWT sessions (8h).
- Authorization is layered (ADR-014): an edge `proxy.ts` optimistic cookie check for `/admin/:path*` (advisory only), a server-side session re-check in the admin route group layout, and a single `requireActor`/`requireAdmin` choke point inside `lib/services/*` that every mutation goes through.
- Server actions under `lib/actions/*` are thin: `auth()` → service → `revalidatePath` → `redirect`. Anonymous action calls are tested to be rejected with no DB writes.
- `AUTH_SECRET` must be a long random value in production; the dev default in `.env.development` is not a production secret.

## Secrets handling
- All environment access is centralized in `lib/env.ts`; nothing under `app/` or `components/` reads `process.env` and no source file outside the allowlist does either (enforced by `tests/security/secrets.test.ts`).
- Only `NEXT_PUBLIC_SITE_URL` is exposed to the browser, and the test suite fails if a `NEXT_PUBLIC_` variable ever looks sensitive (`SECRET`, `TOKEN`, `PASSWORD`, `API_KEY`, `DATABASE_URL`, `PRIVATE`).
- Client components may import `lib/actions/*` (server actions) but must never import `lib/env`, `lib/db`, `lib/services`, `lib/ai`, `lib/auth` or the rate limiter — also enforced by tests.
- `GEMINI_API_KEY`, `AUTH_SECRET`, `DATABASE_URL*`, `ADSENSE_*` and `AFFILIATE_*` are server-side only.

## Response headers (`next.config.ts` → `lib/security/headers.ts`)
Applied to every response:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (plus `frame-ancestors 'none'` in the CSP)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Content-Security-Policy-Report-Only` restricting `default-src`/`base-uri`/`object-src`/`form-action` to self and allowing only the Google AdSense script/frame/connect origins on top
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` **only when `NODE_ENV=production`**

`poweredByHeader` is disabled, so `X-Powered-By` is not emitted.

The CSP is deliberate report-only for now: Next's streaming bootstrap and Google's ad tags require inline scripts, so enforcing it without a nonce would break rendering. Enforcement is planned together with nonce propagation (`middleware`/proxy-generated nonce + `<Script nonce>`), and a `report-to` endpoint.

## Input handling & abuse controls
- The only public write endpoint is `GET /api/track/click?tool=<slug>`. The redirect target is resolved from the database (published tools only, `http(s)` only), so it cannot be abused as an open redirect; unknown or unsafe destinations return `404` and a missing parameter `400`.
- Click rows store a salted SHA-256 of the client IP (`hashIp(ip, AUTH_SECRET)`) and truncated user-agent/referrer — never a raw IP.
- Fixed-window rate limiting (`lib/monetization/rate-limit.ts`, `CLICK_RATE_LIMIT_MAX` / `CLICK_RATE_LIMIT_WINDOW_MS`, default 30 per 60s per IP hash) returns `429` with `Retry-After`. It is in-process only, so multi-instance deployments must move the counter to a shared store (Redis/Postgres).
- All user/DB input passes Zod validation before use; writes go through Drizzle parameter binding, so SQL injection is not exposed via query builders. Raw SQL fragments used for full-text search are static (no interpolation of user input).
- Admin mutations write a `content_revisions` audit row.

## Data protection
- Passwords are stored as bcrypt hashes; sessions are httpOnly cookies managed by Auth.js.
- No third-party analytics or tracking scripts are loaded today other than AdSense, and only when `ADSENSE_CLIENT` plus a slot id are configured.
- Test runs are structurally isolated from dev/prod data (`tests/global-setup.ts` forces `NODE_ENV=test`, refuses non-`_test` databases and resets the `drizzle`/`public` schemas).

## Outstanding before launch
- Enforce CSP (nonce-based) instead of report-only; wire a violation report endpoint.
- Move rate limiting to a shared store and extend it to login + admin mutations.
- Triage the 4 moderate npm advisories (dev toolchain) and add a dependency scan to CI.
- Add CORS/`ALLOWED_ORIGINS` enforcement for `/api/*` if the API is ever consumed cross-origin.
- Add log redaction review for production logging (worker + server) and rotate `AUTH_SECRET`/admin credentials.
- Consider `Cross-Origin-Resource-Policy` and `X-Permitted-Cross-Domain-Policies` once ad behaviour is confirmed in production.
