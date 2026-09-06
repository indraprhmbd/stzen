# Plan: Auth Feature — Best-Practice Login & Sign-In Flow

## Current State Audit

| Layer | What exists | Gaps |
|---|---|---|
| Client session | `@supabase/supabase-js` + `localStorage` | No PKCE, XSS-vulnerable storage, no SSR cookie support |
| Login UI | Google OAuth + email/password in `Login.tsx` | No sign-up, no forgot-password, no email verify, inline styles |
| Route guards | `RequireAuth` / `RequireAdmin` | Client-side only; no server-side guard on protected API routes beyond generic `authMiddleware` |
| Server auth | `jose` + remote JWKS | Works, but doesn't call `getUser()` (more secure than `getSession()`); no rate limit on `/api/v1/auth/*` |
| Role model | `profiles.role` + `user.app_metadata?.role` | Inconsistent source of truth; `RequireAdmin` reads `app_metadata`, server `authMiddleware` ignores role |
| Design tokens | None for auth | Fonts/borders hardcoded in `Login.tsx` |

## Research Findings (Sep 2026)

**Source:** Supabase docs (`/supabase/supabase`, `/supabase/ssr`), Supabase blog, MCP server docs.

1. **Client SDK:** Use `@supabase/ssr` even for SPAs. It provides `createBrowserClient` with PKCE flow by default, replacing the old implicit flow. This is now Supabase’s recommended path for all frameworks.
2. **Session storage:** For SPAs without SSR, `@supabase/ssr`’s `createBrowserClient` still uses `localStorage` under the hood but with PKCE + safer token rotation. For apps that can tolerate cookies, `@supabase/ssr` supports cookie-backed sessions with `createServerClient` middleware.
3. **Server validation:** Use `supabase.auth.getUser()` (not `getSession()`) on the server. It verifies the JWT against the JWKS and checks expiration + revocation.
4. **Auth endpoints:** Supabase Auth already exposes `/auth/v1/signup`, `/auth/v1/forgot-password`, `/auth/v1/verify-otp`, etc. The client calls these directly.
5. **Design tokens:** Supabase Auth UI supports `appearance.theme` with CSS variable tokens (`--brand`, `--brandAccent`, etc.). DaisyUI supports CSS custom properties for colors. These can be unified.
6. **Security hardening:**
   - Enable email confirmation in Supabase dashboard.
   - Set `AUTH_EMAIL_CONFIRMATION=true`.
   - Add rate limiting on auth routes (server).
   - Use `secure: true` + `sameSite: 'lax'` for any cookies.
   - Redirect to `/dashboard` on success, not `/`.

## Proposed Architecture

### 1. Client Auth SDK migration
- Replace `@supabase/supabase-js` with `@supabase/ssr` `createBrowserClient`.
- Keep session in `localStorage` (SPA-compatible) but gain PKCE + safer refresh.
- Add `useAuth` enhancements: `signUp`, `resetPassword`, `updatePassword`, `resendConfirmation`.

### 2. New / updated pages
- **`SignUp.tsx`**: email, password, confirm password. Mirror `Login.tsx` styling.
- **`ForgotPassword.tsx`**: email input → Supabase `resetPasswordForEmail`.
- **`UpdatePassword.tsx`** (or route): after email link click, allow new password.
- **`VerifyEmail.tsx`** (optional): Supabase can auto-handle via redirect, but show a friendly “check your email” state.

### 3. Server-side hardening
- Add dedicated `/api/v1/auth/callback` route to handle OAuth redirects (Google) server-side, validate session with `getUser()`, then issue app-level JWT or set session cookie.
- Add rate limit on auth endpoints (if not already).
- Ensure `authMiddleware` rejects on `exp`/`aud` mismatch (currently done via `jwtVerify`).

### 4. Design tokens for auth UI
- Define CSS custom properties in `client/src/styles/auth.css`:
  ```css
  :root {
    --auth-font-display: 'Space Grotesk', sans-serif;
    --auth-font-body: 'Plus Jakarta Sans', sans-serif;
    --auth-font-mono: 'JetBrains Mono', monospace;
    --auth-color-brand: var(--btn-primary, #000);
    --auth-color-brand-accent: var(--btn-primary-focus, #333);
    --auth-color-text: var(--color-neutral, #1d1d1f);
    --auth-color-bg: var(--color-base-200, #f5f5f7);
    --auth-color-input-bg: var(--color-base-100, #fff);
    --auth-border-thick: 3px;
    --auth-radius: 0.25rem;
    --auth-shadow: 4px 4px 0 var(--shadow-color, #000);
  }
  ```
- Refactor `Login.tsx`, `SignUp.tsx` to use these tokens instead of inline `style` props.
- Add `dark` mode token variants.

### 5. UX / Security flows
- **Sign-up**: Require email confirmation before allowing login. Show “check your email” screen.
- **Login**: On success, redirect to `/dashboard` (or `?redirect=` param).
- **Forgot password**: Email link → `/update-password` route.
- **Session expiry**: Client listens to `onAuthStateChange('TOKEN_REFRESHED')` and updates cached token in `api.ts`.
- **Global sign-out**: Already exists in Settings; ensure `scope: 'global'` invalidates all sessions.

## Implementation Steps

1. Create `docs/auth-full-flow-2026-09-06.md` (this file).
2. Install `@supabase/ssr` in client workspace.
3. Create `client/src/lib/supabase-browser.ts` with `createBrowserClient`.
4. Update `client/src/hooks/useAuth.ts` to use new client + add `signUp`, `resetPassword`, `updatePassword`, `resendConfirmation`.
5. Create `client/src/pages/SignUp.tsx`.
6. Create `client/src/pages/ForgotPassword.tsx`.
7. Create `client/src/pages/UpdatePassword.tsx`.
8. Create `client/src/styles/auth.css` with design tokens.
9. Refactor `Login.tsx` to use design tokens.
10. Add server-side `/api/v1/auth/callback` route in `server/modules/auth/`.
11. Update route guards if needed.
12. Update `App.tsx` routes.
13. Verify build + smoke test.

## Out of Scope (for now)
- Social providers beyond Google
- MFA / 2FA
- SSO / SAML
- Magic link auth
