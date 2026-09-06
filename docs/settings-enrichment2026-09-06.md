# Settings Enrichment: Store, Operational, Account

## Context

Admin settings page holds 6 keys (support contacts, bank details) on a flat ungrouped form. Three operational values are hardcoded: low-stock threshold 5 (`client/src/pages/admin/Overview.tsx:69`, server default `server/modules/admin/admin.stats.routes.ts:40`), vault unlock TTL 10 minutes (`server/shared/lib/unlockToken.ts:12`), CSV export cap 1000 (`client/src/pages/admin/Orders.tsx:203-208`). No account section exists (password change, session control live only in Supabase defaults). Store has no public announcement channel.

Research inputs: Shopify 2026 setup guides (store identity, payments, notifications, staff RBAC), setting.page security UI patterns (status first, sessions inventory, step-up for sensitive actions), VibeWeek settings IA (user-level vs org-level split, deep-linkable sections, toast on save), 2026 SaaS auth guides (passkeys over SMS, idle plus absolute timeouts, HttpOnly over localStorage, global sign-out).

Constraint: solo admin, IDR only, no teams, no SSO. Enterprise patterns (RBAC, SCIM, billing plans) do not apply.

## Decisions

Sectioned single page over split routes. One admin, four groups, no navigation needed. Chose grouped cards over `/settings/*` subroutes because 4 sections fit one scroll and deep-linking has no support use case yet.

Settings service with 60s TTL cache over per-request reads. Unlock TTL and threshold are read on hot paths (every unlock mint, every overview load). Chose in-memory TTL (pattern matches `getStatusCounts` 30s cache in `server/modules/orders/orders.service.ts:23`) over no cache (adds a query per request) and over persistent cache (invalidation complexity unjustified at this write rate). Writes invalidate synchronously.

Per-key Zod validation on PUT over silent store. `ops.low_threshold` int 1-100, `ops.vault_lock_minutes` int 1-60, `ops.csv_limit` int 100-5000. Chose rejection over clamping so admin sees mistakes instead of wondering why 999 minutes did not stick.

Public endpoint allowlists `store.*` only. Announcement must render on the storefront without auth. Chose separate `GET /api/v1/settings/public` with hardcoded allowlist over reusing the admin route (leaks payment and support internals) and over RLS public read (settings table has no RLS posture defined; server allowlist is explicit).

Supabase Auth for password change and global sign-out over custom implementation. `updateUser` hashes server-side, `signOut({scope:'global'})` revokes refresh tokens. Chose platform primitives over new endpoints because no new secrets or sessions are introduced.

Audit extends existing `settings:update` row. Snapshot lists changed keys only, values excluded for `payment.*` (bank numbers in logs create a second secret store).

Deferred: 2FA/passkeys enrollment UI (Supabase MFA available, no demand yet), notification preferences (no notification channel exists), danger zone (no destructive org operation exists).

## Implementation

Step 1, service (`server/shared/lib/settings.ts`, new): `getSetting(key, fallback)`, `getSettings(keys)`, `invalidateSettings()`. Single `SELECT key, value`, module-level `{data, ts}`, 60s TTL.

Step 2, keys: extend `KNOWN_KEYS` and client `LABELS` in `server/modules/admin/admin.settings.routes.ts:15` and `client/src/pages/admin/Settings.tsx:5` with `store.name`, `store.announcement`, `ops.low_threshold`, `ops.vault_lock_minutes`, `ops.csv_limit`. Per-key validators in `SettingsUpdateSchema` path.

Step 3, behavior wiring:
- `server/shared/lib/unlockToken.ts:12`: TTL from `getSetting('ops.vault_lock_minutes', 10)`. Client countdown already server-driven via `expiresAt` (`client/src/features/products/hooks/useVaultManager.ts:75`), zero client change.
- Overview: threshold from settings (fetch once, pass as query param, server default 5 unchanged).
- Orders CSV: limit from settings, server-side cap retained.
- Storefront announcement banner on catalog when `store.announcement` non-empty, fed by public endpoint.

Step 4, page restructure (`client/src/pages/admin/Settings.tsx`): Toko, Pembayaran, Operasional (number inputs with min/max hints), Akun (read-only email plus role from JWT, password change with confirm match, global sign-out with redirect, existing sign-out). Dirty-check save pattern unchanged.

Step 5, public route: `GET /api/v1/settings/public` returns `{store.name, store.announcement}` only, unversioned alongside `/api/health` per API versioning rule (infrastructure, not business).

Step 6, verify: server plus client scoped `tsc`, smoke per key (threshold moves overview counts, lock minutes match relock countdown, announcement renders, global sign-out kills sibling tab session).

## Open Questions

Announcement dismissal persistence (per-browser localStorage vs always-on) undecided. Always-on ships first; dismissal only if admin complains about banner fatigue.

Low-stock threshold source of truth after change: settings value vs threshold query param. Client passes settings value explicitly; direct API callers keep server default 5. Documented here so the dual path is intentional, not drift.
