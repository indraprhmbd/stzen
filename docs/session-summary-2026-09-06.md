# Session Summary - 2026-09-06

## Context
- Supabase client rewrite completed earlier; this session fixed regressions and completed auth/security/vault/admin UX work.
- Server runs on Cloudflare Workers via `npx wrangler dev` from `server/`.
- Client dev server: Vite on `5173`, API proxied to `8787`.
- For mobile/other-device access: use ngrok tunnel + `CORS_ALLOWED_ORIGINS` in `server/wrangler.jsonc`.

## Auth & Security
- Implemented full auth flow: `@supabase/ssr` `createBrowserClient` (PKCE), auth callback, sign up/reset/update password pages.
- Added rate limiting on `/api/v1/auth/*` (20/min) and `/api/v1/orders/*` (60/min).
- Added `isSafeNext()` validator in auth routes.
- Added explicit security headers: CSP/HSTS/Referrer-Policy/Permissions-Policy.
- Fixed global error handler to catch `HTTPException` so auth failures return 401 instead of 500.

## Server DB Client
- All server modules now use `supabaseAdmin` (service role), not anon `supabase`.
- Files changed: `orders.service.ts`, `orders.credentials.routes.ts`, `products.service.ts`, `vault.service.ts`, `admin.*.routes.ts`, `checkout.service.ts`, `settings.ts`, `db-helpers.ts`.

## Supabase Relation Arrays
- Supabase JS returns joined relations as **arrays**, not single objects.
- Every mapper that accessed `.products?.id`, `.orders?.public_id`, `.product_variants?.fulfillment_type`, etc. was broken.
- Normalized pattern: `Array.isArray(x) ? x[0] : x` before accessing relation fields.
- Applied across: orders, credentials, vault, admin variants/stats/analytics.

## Products Service
- `listAll()` returns flat camelCase objects with `category`, `badge`, `isActive`, `price`, `instructions`, `overview`.
- `listActive()` / `getById()` added missing `id` column to select.
- `listPaginated()` total uses `filtered.length` before stock filtering.

## Orders Service
- Added `mapOrderRow()` helper for consistent flat `OrderWithProduct` shape.
- `getPayableDetails()` / `findPayableByProviderRef()` fetch `fulfillment_type` directly from `product_variants` by `variant_id` instead of relying on relation.
- `listAll()` restored search coverage for `products.name` and `profiles.email` via JS filter (PostgREST `or` with relation columns proved unreliable).
- `listAll()` countQuery mirrors search filter.
- `createdAt`/`paidAt` standardized to ISO strings.

## Delivery Flow
- `deliverWithCredential()` split on-demand and vault paths.
- On-demand: import credential into `vault_items` with `status: 'SOLD'`, use inserted ID directly.
- Vault: uses `allocateCredential()` RPC.
- Existing delivered on-demand orders now show in vault UI as `SOLD`.

## Vault Service
- `listByVariant()` normalizes `r.orders` relation array before accessing `public_id`/`status`.
- Added `fulfillmentType` to vault list items.
- `revoke()` now allows both `SOLD` and `AVAILABLE` credentials linked to delivered orders.

## Vault Rotation / Replace
- `replace()` now detects `fulfillment_type` from `product_variants`.
- On-demand: skips RPC, requires manual credential input, inserts new `SOLD` vault item.
- Vault: tries RPC first, then fallback variant, then manual credential.
- New server endpoint: `POST /api/v1/admin/vault/replace/:orderId` accepts `{ credential?, fallbackVariantId? }`.
- Client `rotateCred()` supports `{ credential, fallbackVariantId }`.
- UI: on-demand rotate opens credential-input dialog directly; vault rotate uses confirm → fallback dialog.
- Added `ArrowUpRightSquare` button in vault table ORDER column to navigate to admin orders filtered by that order ID.

## Admin Variant Edit 500
- Root cause: empty `productId: ''` was sent to Postgres UUID column → rejected.
- Normalize empty string `productId` to `null` in PUT handler.
- Explicit camelCase → snake_case mapping in all admin create/update handlers:
  - `admin.variants.routes.ts`
  - `admin.products.routes.ts`

## Admin Stats / Analytics
- Fixed `variant.products?.name` and `order.products?.name` relation access to handle arrays.
- `admin.stats.routes.ts` low-stock summary uses dedicated `outOfStock`/`runningLow` counts from server when available.

## Public Settings
- Added `publicSettingsRoutes` at `/api/settings/public` (no auth).
- Returns `{ whatsapp, telegram, email }`.
- `server/modules/admin/index.ts` exports `publicSettingsRoutes`.
- Mounted in `app.ts` before auth middleware.
- `getSetting()` in `settings.ts` switched to `supabaseAdmin`.

## CORS & Mobile Access
- `CORS_ALLOWED_ORIGINS` in `server/wrangler.jsonc` includes ngrok domain.
- For mobile: set `VITE_API_BASE_URL=https://<ngrok-domain>` so client bypasses Vite localhost proxy.
- Supabase Auth redirect URLs must include ngrok callback in dashboard settings.

## Orders UI
- Action buttons standardized: Edit = `EditPencil`, Hapus = `Trash`, Struk = text-only.
- Alur column changed from pills to normal-case text: `On-demand`, `Vault`, `Stok habis`. Joined with `, ` when both apply.
- Mobile alignment: removed `truncate` from PRODUK and PELANGGAN columns so flex layout pushes content right.
- Orders search filter: removed `user_id` from PostgREST `or` ilike (UUID doesn’t support `ILIKE`); escaped `%`/`_` in search term.

## Vault Manager UI
- On-demand variants now appear in vault manager dropdown, labeled “on demand”.
- Key icon on admin orders shows for both vault and on-demand.

## Product Card
- Changed from `description` to `overview` in `ProductCard.tsx` and `ProductList.tsx` types.

## Footer
- Wired contact links (WhatsApp, Telegram, Email) to public settings API.
- Falls back to `brand.config.ts` when API returns empty.

## Ngrok / Deployment
- CORS configured via `wrangler.jsonc` vars.
- For local dev across devices: `VITE_API_BASE_URL=https://<ngrok-domain> npm run dev`.
- Restart `npx wrangler dev` and clear `.wrangler/tmp/*` after code changes.

## Commits
- `fix(auth,server,client): auth flow, security hardening, and supabase rewrite fixes`
- `fix(admin): add variant update error logging for debugging`
- `fix(admin): map camelCase payloads to snake_case for Supabase columns`
- `fix(orders): use correct p_variant_id/p_order_id params for allocate_credential RPC`
- `fix(vault): use correct p_variant_id/p_order_id params for replace_order_credential RPC`
- `fix(vault,orders): fallback rotation options and escape PostgREST search wildcards`
- `fix(orders): remove uuid user_id from ilike search filter`
- `fix(vault,orders): allow revoke/rotate for on-demand delivered credentials`
- `fix(vault): propagate rotate failure so fallback dialog opens`
- `fix(vault): on-demand rotate requires manual credential, vault uses RPC fallback`
- `fix(ui): fix rotate fallback dialog textarea box alignment`
- `feat(admin,vault): show on-demand variants in vault manager and key icon for all fulfillment types`
- `fix(admin): include regenerated name/sku in variant update query`
- `fix(admin): persist pendapatan visibility with localStorage`
- `fix(orders): remove truncate from produk/pelanggan so mobile flex alignment works`
- `style(orders): use normal case for alur column`
- `feat(products): add vault access action button on variant rows`
- `style(admin): use consistent icons for action buttons across tables`
- `feat(footer,settings): wire footer contact links to public settings API`
