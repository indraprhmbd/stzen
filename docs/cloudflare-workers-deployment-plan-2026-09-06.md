# Project Scan: Store Subs App

## Summary
Credential storefront selling digital accounts/subscriptions. Admin imports encrypted credentials (AES-256-GCM), buyers purchase, admin approves/delivers. Recent work: vault overhaul with REVOKED status, unlock gate, rotate/replace flow.

## Stack
- **Backend:** Hono (Node), modular monolith, TypeScript strict
- **Frontend:** React + Vite, DaisyUI neubrutalism
- **Database:** Supabase PostgreSQL + Drizzle ORM
- **Auth:** Supabase Auth (JWT via Hono middleware)
- **Payments:** Scaffold (manual/duitku/sumopod), webhook-driven

## Data Model
- `profiles` — extends auth.users, role enum (customer/admin)
- `products` — base catalog (name, category, price, badge, instructions)
- `product_variants` — purchasable SKU (30+ rows, 5-6 parents), duration, accountType, fulfillmentType
- `vault_items` — encrypted credentials (AES-256-GCM), status enum (AVAILABLE/SOLD/RESERVED/REVOKED)
- `orders` — PENDING/PAID/DELIVERED/REFUNDED/REJECTED, snapshots variant data, paymentRef, vaultItemId pointer

## Server Modules
- `products` — public catalog, stock counts
- `checkout` — create order with atomic allocation via `allocate_credential` RPC
- `orders` — buyer history, state machine
- `vault` — import/decrypt/revoke/rotate/replace, HMAC unlock gate
- `admin` — order management, product CRUD, stock import
- `payments` — provider scaffold + webhooks

## Current State
- Modular monolith refactor completed (Aug 27)
- Vault overhaul built (Sep 5): REVOKED enum, unlock token, in-place edit, paginated admin list
- Payments scaffold present (Sep 4)
- RLS enforced; server connects as postgres superuser via pooler (port 6543)

## Open Questions / Risks
- Next epic not defined in docs
- `product_variants.deletedAt` is timestamp but not used in enum — soft delete by timestamp?
- `orders.vaultItemId` is nullable — what happens if allocation fails mid-transaction?
- Payment webhook retry logic not documented

## Deployment Target: Full Cloudflare (0-cost)

### Goal
Run entire stack on Cloudflare free tiers:
- Frontend: Cloudflare Pages (free)
- Backend: Cloudflare Workers (free: 10M requests/day)
- Database: Supabase Postgres free tier via HTTP
- CI/CD: GitHub Actions free tier for public repos

### Current Blockers for Workers
1. **Runtime:** `server/index.ts` uses `@hono/node-server` and `dotenv`; Workers don't support raw TCP or filesystem
2. **Database driver:** `postgres` package requires TCP; Workers need HTTP-based access
3. **ORM:** Drizzle + `postgres` dialect requires TCP; must replace with `@supabase/supabase-js` in Workers
4. **Auth callback:** Server callback sets `sb_access_token` cookie; Workers can set cookies but need Hono response helpers
5. **CORS:** Current CORS hardcodes localhost origins; needs env-based allowlist

### Recommended Path: Workers + Supabase HTTP
- Keep Supabase for Postgres + Auth (free tier)
- Replace Drizzle/`postgres` with `@supabase/supabase-js` in Workers
- Keep Hono app, remove Node server
- Add `wrangler.jsonc` + Vite Cloudflare plugin
- Frontend: Cloudflare Pages with `vite.config.ts` base path
- Keep `allocate_credential` as a Supabase stored procedure, call it via `supabase.rpc()` from Workers

### Trade-offs
- **Pros:** 0 hosting cost, fast edge runtime, unified Cloudflare auth for CI/CD, keeps existing Postgres schema/RLS
- **Cons:** Rewrite DB layer from Drizzle to Supabase client; Workers cold starts; lose Drizzle migrations in favor of Supabase migrations or manual SQL

### Implementation Steps
1. Add `wrangler.jsonc` and `@cloudflare/vite-plugin`
2. Add server `build` script for Workers bundling
3. Create `server/workers-entry.ts` exporting Hono app for Workers
4. Remove Node-only deps: `@hono/node-server`, `dotenv`, `postgres`, `drizzle-orm` from Workers runtime
5. Rewrite DB access layer to use `@supabase/supabase-js` client
6. Keep `allocate_credential` as a Supabase DB function; call it via `supabase.rpc('allocate_credential', ...)` from Workers
7. Update CORS to use env vars for allowed origins
8. Update auth callback to use Hono `c.header('Set-Cookie', ...)` in Workers
9. Add GitHub Actions workflow with `cloudflare/wrangler-action@v4`
10. Configure Cloudflare Pages build: `npm run build` from client, output `dist/`

### Validation
- `wrangler dev` runs locally
- `wrangler deploy` publishes Worker
- Cloudflare Pages deploy succeeds
- Auth flow works end-to-end on production URL
- Google OAuth redirect URI updated in Supabase dashboard

### Out of Scope
- D1 migration
- Custom domain (use `*.workers.dev` and `*.pages.dev`)
- Monitoring beyond Cloudflare Analytics

## Security Audit Plan

### Scope
- Full auth flow: `client/src/lib/supabase-browser.ts`, `client/src/hooks/useAuth.ts`, `client/src/pages/Login.tsx`, `SignUp.tsx`, `ForgotPassword.tsx`, `UpdatePassword.tsx`
- Server auth: `server/modules/auth/auth.routes.ts`, `server/shared/middleware/auth.ts`
- App-wide: `server/app.ts`, route guards, API client token caching
- Dependencies: root `package.json`, `client/package.json`, `server/package.json`
- Secrets/config: `.env.example`, any hardcoded values, public repo risk

### Audit Steps
1. **Header security baseline**
   - Add `secureHeaders()` middleware in `server/app.ts` before route mounts
   - Configure CSP nonce or strict static sources; verify Vite dev server compatibility
   - Add HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
   - Add CSP violation reporting endpoint or `report-to`
   - Test headers with securityheaders.com or Mozilla Observatory

2. **Dependency scan**
   - Run Snyk SCA on `client` and `server` workspaces (low+ threshold)
   - Review `npm audit` output for both
   - Verify Hono >=4.12.34, drizzle-orm >=0.45.2, esbuild via drizzle-kit is latest
   - Flag any `high`/`critical` findings; document accepted dev-only risks

3. **Auth flow review**
   - Verify PKCE is actually used by `@supabase/ssr` `createBrowserClient`
   - Check session storage: confirm no plaintext tokens in localStorage beyond what Supabase SDK requires
   - Verify redirect URIs are validated server-side in `/api/v1/auth/callback`
   - Ensure `exchangeCodeForSession` validates `state`/`code` and does not accept reused codes
   - Confirm cookie flags: `HttpOnly; Secure; SameSite=Lax` — review if `Secure` breaks localhost during dev
   - Validate `next` param in callback is same-origin relative path only

4. **Server hardening**
   - Confirm `authMiddleware` rejects expired/revoked JWKS via `jwtVerify`
   - Add rate limiting to auth routes (`/api/v1/auth/*`) using `hono-rate-limiter` or similar
   - Verify no admin routes bypass `requireRole('admin')`
   - Review CORS middleware origin allowlist and `credentials: true` pairing

5. **Client hardening**
   - Review `useAuth` token caching TTL vs Supabase access token lifetime
   - Verify `onAuthStateChange` handles `TOKEN_REFRESHED` to update cache
   - Check `authedApiRequest` timeout/retry behavior
   - Ensure no secrets logged to console

6. **Design/systemic**
   - Review `.env.example` for placeholder values that might be committed
   - Check for hardcoded URLs/keys in source
   - Verify CORS allowlist is correct for dev + production
   - Confirm no `service_role` key exposure in client bundle

### Out of Scope
- Penetration testing / live exploit attempts
- Infrastructure/network layer (Cloudflare, Supabase infra)
- Payment provider security (Duitku/SumoPod) beyond config exposure

### Header Security Baseline (Must)
Modern browsers expect explicit security headers. Implement these on all responses before further hardening:

1. **CSP with nonce-based scripts/styles**
   - Use `hono/secure-headers` `secureHeaders()` with `NONCE` or custom generator
   - Start permissive, tighten after scanning for inline scripts/styles
   - Add `report-uri` or `report-to` endpoint for violation monitoring

2. **HSTS**
   - `max-age=63072000; includeSubDomains; preload` in production
   - Disable or short max-age in local dev over HTTP

3. **Browser anti-abuse headers**
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: geolocation=(), microphone=(), camera=()`

4. **CORS hardening**
   - Explicit origin allowlist; avoid `*` for authenticated routes
   - Verify Hono CORS middleware does not reflect `Vary` from request (CVE-2025-71381 fixed in >=4.10.3)
   - Ensure `Access-Control-Allow-Credentials: true` only with explicit origins

### Dependency & Version Audit
Pin exact versions and verify minimum safe versions against September 2026 CVE data:

- **Hono**: upgrade to >=4.12.34 to fix CVE-2026-71849 (proxy helper hop-by-hop header leakage). Also addresses CVE-2026-59896, CVE-2026-59895, CVE-2025-59139, CVE-2026-54287/286/288, CVE-2026-47674.
- **Drizzle ORM**: upgrade to >=0.45.2 to fix CVE-2026-39356 (SQL identifier injection, CVSS 7.5 HIGH). If using beta, use >=1.0.0-beta.20.
- **esbuild**: multiple CVEs in 2025-2026 (resource exhaustion, path traversal on Windows). In this project it is a transitive dev dependency via `drizzle-kit`. Acceptable risk if:
  - `drizzle-kit` is upgraded to latest
  - esbuild is not exposed to untrusted input in dev server
  - Production build artifacts are not runtimeserving esbuild
- **@supabase/ssr**: verify version uses PKCE and correct cookie defaults

### Deliverable
- Findings table: severity, location, description, remediation
- Verified-clean list
- Risk-rated summary for user decision
- Header security baseline config for Hono
- Dependency version pins with CVE rationale
