# Security Audit Report — Store Subs App
**Date:** 2026-09-06  
**Auditor:** Kilo  
**Scope:** Full auth flow, server hardening, header security, dependency versions  
**Standard:** OWASP Top 10, Hono secure headers baseline, September 2026 CVE intelligence

---

## Executive Summary

| Category | Status | Summary |
|----------|--------|---------|
| Dependency versions | Clean | Hono and Drizzle ORM meet minimum safe versions |
| Auth flow | 1 finding | Open redirect risk in callback `next` param |
| Server hardening | 1 finding | Auth routes missing rate limiting |
| Header security | 2 gaps | CSP and HSTS not explicitly configured |
| Client storage | Clean | No auth tokens in localStorage |
| Admin authorization | Clean | All admin routes enforce `requireRole('admin')` |
| Secret exposure | Clean | No `service_role` key in client bundle |

**Risk rating:** Low-to-medium. No critical or high-severity findings. Two medium-severity issues require remediation before production.

---

## 1. Dependency & Version Audit

### Clean

| Package | Current | Required | CVE Addressed |
|---------|---------|----------|---------------|
| `hono` | `^4.13.5` | `>=4.12.34` | CVE-2026-71849, CVE-2026-59896, CVE-2026-59895, CVE-2025-59139, CVE-2026-54287/286/288, CVE-2026-47674 |
| `drizzle-orm` | `^0.45.2` | `>=0.45.2` | CVE-2026-39356 (SQL identifier injection, CVSS 7.5) |
| `@supabase/ssr` | `^0.12.6` | latest | PKCE flow, cookie defaults |

### Accepted Risk: esbuild (transitive dev dep)

`drizzle-kit@0.30.5` depends on `esbuild`, which has multiple 2025-2026 CVEs:
- CVE-2025-61726: resource exhaustion via query parameter parsing
- CVE-2025-61731: write to attacker-controlled file
- CVE-2026-44594: local file inclusion via esbuild plugin browser field
- CVE-2025-22866/22871: request smuggling / bare LF handling

**Risk acceptance criteria met:**
- `esbuild` is a transitive dev dependency only, not in production bundle
- `drizzle-kit` is used for DB migrations/studio, not for runtime request handling
- Dev server is not exposed to untrusted input in this architecture

**Recommendation:** Document accepted risk. Upgrade `drizzle-kit` when new versions are published.

---

## 2. Auth Flow Review

### Clean

| Check | Status | Detail |
|-------|--------|--------|
| PKCE flow | Clean | `@supabase/ssr` `createBrowserClient` uses PKCE by default |
| Token storage | Clean | No auth tokens in `localStorage`; only Supabase SDK-managed cookies |
| JWT verification | Clean | `jwtVerify` with remote JWKS, issuer validation |
| Cookie flags | Clean | `HttpOnly; Secure; SameSite=Lax` on session cookie |
| Admin role guard | Clean | All 8 admin sub-routes use `.use('*', requireRole('admin'))` |
| Service role exposure | Clean | `SUPABASE_SERVICE_ROLE_KEY` only in server code, not in client bundle |

### Finding: Open Redirect in Auth Callback

**Severity:** Medium  
**Location:** `server/modules/auth/auth.routes.ts:38-79` (GET) and `:82-118` (POST)

**Description:**
The `next` query parameter is used directly in the `Location` header without validation:

```ts
const next = c.req.query('next') || '/dashboard'
// ...
return c.newResponse(null, {
  status: 302,
  headers: { Location: next, ... }
})
```

An attacker can craft a link such as:
```
https://your-app.com/api/v1/auth/callback?code=abc&next=https://evil.com/phish
```

After the user authenticates, they are redirected to the attacker site. This enables phishing attacks that look legitimate because the domain initially shows your app.

**Remediation:**
Validate `next` as a same-origin relative path before using it.

---

## 3. Server Hardening

### Clean

| Check | Status | Detail |
|-------|--------|--------|
| JWKS verification | Clean | `jwtVerify` with issuer check, rejects expired tokens |
| Global auth gate | Clean | Default-deny in `app.ts`; public prefixes explicitly allowlisted |
| CORS origin allowlist | Clean | Explicit `allowedOrigins` + LAN pattern; no `*` |
| Rate limits | Clean | Admin (60/min), checkout (30/min), payments (30/min), webhooks (120/min) |

### Finding: Auth Routes Missing Rate Limit

**Severity:** Medium  
**Location:** `server/app.ts:53-66`

**Description:**
The following routes have no rate limiting:
- `/api/v1/auth/*` - login, signup, password reset, callback
- `/api/v1/orders/*` - order history and detail

While `/api/v1/auth/*` is protected by Supabase own rate limiting, application-level rate limiting provides defense-in-depth against credential stuffing and brute-force attacks.

**Remediation:**
Add rate limiters for auth and orders.

---

## 4. Header Security Baseline

### Current State

`secureHeaders()` is applied globally in `server/app.ts:25` with default settings.

**Default headers from `hono/secure-headers`:**
- `X-Powered-By: removed` ✅
- `X-Frame-Options: DENY` ✅
- `X-Content-Type-Options: nosniff` ✅

**Missing / not explicitly configured:**
- `Content-Security-Policy` — not set
- `Strict-Transport-Security` — not set
- `Referrer-Policy` — not set
- `Permissions-Policy` — not set

### Recommendations

Add explicit `secureHeaders()` configuration in `server/app.ts`.

---

## 5. Client Hardening

### Clean

| Check | Status | Detail |
|-------|--------|--------|
| localStorage usage | Clean | Only stores `admin-sidebar-collapsed` UI state and language preference |
| Token caching | Clean | Supabase SDK manages session in HttpOnly cookies |
| Auth state sync | Clean | `onAuthStateChange` updates React state on sign-in/sign-out/token refresh |
| Console secrets | Clean | No secrets logged to console |

---

## 6. Design / Systemic

### Clean

| Check | Status | Detail |
|-------|--------|--------|
| `.env.example` | Clean | Contains only placeholder values; no real secrets |
| Hardcoded URLs | Clean | Only localhost dev URLs in `app.ts` CORS config and `index.ts` startup logs |
| Service role exposure | Clean | `SUPABASE_SERVICE_ROLE_KEY` only referenced in server code |
| CORS allowlist | Clean | Explicit origins for dev; LAN pattern for local network testing |

---

## 7. Findings Summary

| # | Severity | Finding | Location | Remediation |
|---|----------|---------|----------|-------------|
| 1 | Medium | Open redirect via unvalidated `next` param | `server/modules/auth/auth.routes.ts` | Validate as same-origin relative path |
| 2 | Medium | Auth routes lack rate limiting | `server/app.ts` | Add rate limit to `/api/v1/auth/*` |
| 3 | Low | No explicit CSP header | `server/app.ts` | Add `contentSecurityPolicy` to `secureHeaders()` |
| 4 | Low | No HSTS header | `server/app.ts` | Add `strictTransportSecurity` to `secureHeaders()` |
| 5 | Info | esbuild transitive CVEs via drizzle-kit | `server/package.json` | Accept as dev-only risk; document and upgrade drizzle-kit when available |

---

## 8. Verified Clean

- Hono >= 4.12.34 (CVE-2026-71849 and related fixes)
- Drizzle ORM >= 0.45.2 (CVE-2026-39356)
- PKCE auth flow via `@supabase/ssr`
- JWT verification with JWKS + issuer validation
- HttpOnly + Secure + SameSite=Lax cookies
- All admin routes enforce `requireRole('admin')`
- No auth tokens in localStorage
- No `service_role` key in client bundle
- Explicit CORS origin allowlist
- Rate limiting on admin, checkout, payments, webhooks

---

## 9. Accepted Risks

### esbuild Transitive CVEs via drizzle-kit

**Packages affected:** `esbuild` (transitive via `drizzle-kit@0.30.5`)  
**CVEs:** CVE-2025-61726, CVE-2025-61731, CVE-2026-44594, CVE-2025-22866, CVE-2025-22871  
**Risk level:** Low (dev-only)

**Justification:**
- `esbuild` is a transitive dev dependency, not included in production bundle
- `drizzle-kit` is used only for database migrations and studio, not for runtime request handling
- The dev server is not exposed to untrusted input in this architecture
- Production build artifacts do not runtime-serve esbuild

**Mitigation:**
- Upgrade `drizzle-kit` when new versions are published
- Re-run Snyk SCA after each dependency update

---

## 10. Recommended Next Steps

1. Verify implemented fixes: open redirect validation, rate limits, security headers
2. Add CSP violation reporting endpoint
3. Re-run Snyk after implementing above to verify no new findings
