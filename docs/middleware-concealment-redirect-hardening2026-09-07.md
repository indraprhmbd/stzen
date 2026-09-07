# Middleware Concealment and Redirect Hardening

## Context

API returned 403 on `/api/v1/admin/*` for non-admin callers (`server/shared/middleware/require-role.ts`). 403 confirms resource existence. Attacker probing `/admin*` learns the admin surface exists and builds a target list. SPA compounded the oracle: `RequireAdmin` redirected non-admin to `/dashboard` and logged-out users to `/login` (`client/src/components/RequireAdmin.tsx`), confirming `/admin` exists through navigation behavior alone.

Second surface: user-controlled redirect sink in `GET|POST /api/v1/auth/callback?next=` (`server/modules/auth/auth.routes.ts:42,95`). Existing `isSafeNext` guard used WHATWG URL parse plus origin check, structurally sound but missing explicit rejects from the 2026 OWASP Unvalidated Redirects checklist (backslash, userinfo, control chars) and had no rejected-attempt logging or unit tests.

Requirement: unauthorized callers receive 404 identical to a nonexistent route, on API and SPA. No redirects that confirm existence.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Concealment scope | `/api/v1/admin/*` and SPA `/admin*` only | Concealment applies per endpoint class (2026 consensus: mixed 403/404 on one class creates an oracle). Admin paths are unpublished and enumeration sensitive. Order ownership, vault scoping, settings keep explicit 403 because the caller already knows the resource exists (own order, own team), and 403 preserves support debuggability there |
| Missing/invalid token on `/admin*` | 404, same as wrong role | Full concealment per user requirement. Unauthenticated prober learns nothing. Cost: legit admin with expired session sees 404 instead of auto login prompt. Accepted because Supabase client refreshes sessions silently, expiry mid session is rare, and the 404 page carries generic Login/Home links usable by anyone |
| 401 preserved elsewhere | All other `/api/v1/*` keep 401 on bad token | SPA re-login flow keys on 401. Uniform 401 across every non-public route reveals nothing (no per-route variance) |
| Guard placement | Central `.use` in `admin.routes.ts` composer, delete 7 per-file guards | One enforcement point guarantees uniform class policy. Per-file guards drift. Chose central over per-file because a new sub-router that forgets its guard now fails closed through the composer |
| POST `/callback` status | 200 JSON `{ok, user, next}` instead of 302 with JSON body | 302 with a JSON body and `Location` header is incoherent (no browser follows it for XHR, no client reads `Location` from it). Client navigates from the `next` field after validating it is a safe path. GET callback keeps 302, it serves real browser OAuth navigation |
| `isSafeNext` hardening | Explicit rejects added on top of existing origin check | WHATWG parse already defeats `//evil`, `\evil`, scheme tricks by normalizing to a foreign origin. Explicit rejects are defense in depth plus auditability: each reject path logs. Chose explicit over parser-only because parser behavior across runtimes is the documented bypass vector (WHATWG vs RFC 3986 differentials, 2023-2026 literature) |
| SPA denial render | Same `NotFound` component for concealed and true 404 | Byte-identical render, no oracle. `RequireAuth` (dashboard, profile) keeps `/login` redirect: known-user routes, not concealed scope |

Sources: RFC 9110 Section 15.5.5 (MAY return 404 to hide forbidden target), MDN 403 reference (2026-06-22), OWASP Unvalidated Redirects and Forwards Cheat Sheet, OWASP open redirect attack page, Hono docs `notFound`/`HTTPException`/`onError` via Context7 (`/honojs/hono`), React Router splat/catch-all docs via Context7 (`/remix-run/react-router`).

## Implementation

### Server concealment

`server/shared/middleware/require-role.ts`: `requireRole(...roles)` gains trailing options param `{ conceal?: boolean }`. Conceal true throws `NotFoundError('Not found')` instead of `ForbiddenError`. Default false, existing callers unaffected.

`server/modules/admin/admin.routes.ts`: single `.use('*', requireRole('admin', { conceal: true }))` on the composer. Per-file `.use('*', requireRole('admin'))` lines removed from all 8 sub-routers (orders, products, variants, stats, history, analytics, settings, vault).

`server/app.ts` default-deny gate: scoped override for path prefix `/api/v1/admin/`. Auth failures (missing header, JWT verify reject) inside that prefix throw `NotFoundError('Not found')` with the standard 404 body. Implementation wraps the existing `authMiddleware` call in try/catch only when `c.req.path.startsWith('/api/v1/admin/')`. All other prefixes keep 401.

Internal telemetry: concealment points log `console.warn('[concealed_not_found]', { path, reason })` with reason `no_token`, `bad_token`, or `wrong_role`. External body stays `{error: 'Not found'}`, identical to `app.notFound` handler. Existing 60/min admin rate limit (`app.ts:96`) blunts enumeration and timing probes, no change.

### Redirect hardening

`server/modules/auth/auth.routes.ts` `isSafeNext` additions: reject backslash anywhere, `@` before first `/`, control chars (`\x00-\x1f`, `\x7f`), `javascript:` and `data:` schemes (case insensitive, leading whitespace trimmed). Remove redundant `/dashboard` special case. Log rejected values as `[redirect_blocked]` with the raw input.

Unit tests `server/modules/auth/__tests__/isSafeNext.test.ts`: allow/deny matrix covering `//evil.com`, `\evil.com`, `/\evil.com`, `https://stzen.web.id@evil.com`, `https:evil.com`, `javascript:alert(1)`, `JaVaScRiPt:alert(1)`, `%2F%2Fevil.com`, `/dashboard`, `/admin/orders`, `dashboard`, empty. Runner: check `server/package.json` test setup during implementation, add `vitest` or `node:test` whichever fits installed toolchain.

### SPA

New `client/src/pages/NotFound.tsx`: brutal styled 404 (Space Grotesk 404 headline, Home + Login buttons, generic copy usable by any visitor).

`client/src/components/RequireAdmin.tsx`: denial branch (no session or role not admin) returns `<NotFound/>`, removes both `<Navigate/>` imports.

`client/src/App.tsx`: add `<Route path="*" element={<NotFound/>}/>`. `RequireAuth` untouched.

### Verification

Manual matrix on staging: `GET /api/v1/admin/orders` with no token, bad token, customer token, plus `GET /api/v1/admin/nope` with admin token. All five return byte-identical 404 `{error: 'Not found'}`. `GET /api/v1/orders` without token still 401. Admin token on valid admin routes still 200. Browser logged out and as customer: `/admin`, `/admin/orders`, `/nope` render the same 404 page with no URL change. Callback `?next=//evil.com` and `?next=https://stzen.web.id@evil.com` fall back to `/dashboard`. Snyk SAST re-run on `auth.routes.ts`, `require-role.ts`, `app.ts` (on-demand MCP, no CI).

## Open Questions

Timing side channel: concealed 404 (JWT verify + role compare) vs true 404 (router miss) differ by microseconds to single milliseconds. Residual risk accepted at current threat level. Revisit with constant-time padding only if timing probes appear in logs.

Lazy `AdminLayout` chunk fetch on `/admin` visit is a weak network-tab oracle. Accepted: visitor already typed the path, chunk name reveals nothing about data.

`next` param allowlist vs relative-only: relative-only chosen because no legitimate post-OAuth destination leaves origin. Revisit if white-label domains arrive, then move to tenant-aware allowlist per 2026 guidance.
