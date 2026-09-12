# Post-Supabase Rewrite Regression Fixes - 2026-09-06

## Summary
The Supabase client rewrite introduced multiple regressions: relation data came back as arrays instead of single objects, server queries used the anon client (triggering RLS blocks), form sends included empty strings for UUID columns, and the delivery flow shared a broken allocation path for both on-demand and vault orders.

## Root Cause
Supabase JS returns joined relations as **arrays**, not single objects. Drizzle previously returned flat joined rows. Every mapper that accessed `.products?.id`, `.orders?.public_id`, `.product_variants?.fulfillment_type`, etc., silently broke. Additionally, the server was created with the **anon** Supabase client instead of `supabaseAdmin`, so server-side queries were blocked by RLS.

## Fixes Applied

### Server DB Client
- **All server modules**: replaced `supabase` (anon) with `supabaseAdmin` (service role)
  - `server/shared/db/index.ts` - exports both clients
  - `server/modules/orders/orders.service.ts`
  - `server/modules/orders/credentials.routes.ts`
  - `server/modules/products/products.service.ts`
  - `server/modules/vault/vault.service.ts`
  - `server/modules/admin/admin.products.routes.ts`
  - `server/modules/admin/admin.variants.routes.ts`
  - `server/modules/admin/admin.orders.routes.ts`
  - `server/modules/admin/admin.stats.routes.ts`
  - `server/modules/admin/admin.analytics.routes.ts`
  - `server/modules/admin/admin.settings.routes.ts`
  - `server/modules/checkout/checkout.service.ts`
  - `server/shared/lib/settings.ts`
  - `server/shared/lib/db-helpers.ts`

### Relation Array Access Pattern
All mappers normalized Supabase relation arrays:
- `order.products?.name` → `Array.isArray(order.products) ? order.products[0]?.name : order.products?.name`
- `order.product_variants?.fulfillment_type` → `Array.isArray(order.product_variants) ? order.product_variants[0]?.fulfillment_type : ...`
- `r.orders?.public_id` → `Array.isArray(r.orders) ? r.orders[0]?.public_id : r.orders?.public_id`
- `variant.products?.name` → `Array.isArray(variant.products) ? variant.products[0]?.name : variant.products?.name`

### Error Handling
- **server/shared/errors/handler.ts**: added `HTTPException` handling so auth failures return 401 instead of 500

### CORS
- **server/app.ts**: added `X-Vault-Token` to `allowHeaders`

### Products Service (`server/modules/products/products.service.ts`)
- `listAll()`: returns flat camelCase objects with `category`, `badge`, `isActive`, `price`, `instructions`
- `listActive()`: added `id` to select
- `getById()`: added `id` to select
- `listPaginated()`: use `filtered.length` for total instead of `withStock.length`

### Orders Service (`server/modules/orders/orders.service.ts`)
- Added `mapOrderRow()` helper
- `getPayableDetails()` / `findPayableByProviderRef()`: fetch `fulfillment_type` directly from `product_variants` by `variant_id` instead of relying on relation
- `listAll()`: restored search coverage for `products.name` and `profiles.email`
- `listAll()`: fixed `countQuery` search coverage
- `listAll()`: standardized `createdAt`/`paidAt` to ISO strings
- `deliverWithCredential()`: split on-demand and vault paths; on-demand inserts credential and uses inserted ID directly

### Vault Service (`server/modules/vault/vault.service.ts`)
- `listByVariant()`: normalize `r.orders` relation before accessing `public_id`/`status`
- Added debug logging to `allocateCredential()` to catch RPC errors/empty results

### Admin Variants Route (`server/modules/admin/admin.variants.routes.ts`)
- Variant mapping: `productId: product?.id` → `productId: product?.public_id` (matches `products.id` on frontend)
- Added `public_id` to products relation select
- PUT endpoint: normalize empty-string `productId` to `null` and filter out `undefined` values from update payload

### Admin Stats/Analytics Routes
- `admin.stats.routes.ts`: normalize `variant.products` relation before accessing `name`
- `admin.analytics.routes.ts`: normalize `order.products` relation before accessing `name`

### Public Settings
- **server/modules/admin/admin.settings.routes.ts**: added `publicSettingsRoutes` with unauthenticated `GET /`
- `server/shared/lib/settings.ts`: switched to `supabaseAdmin` for public endpoint

### Client
- **client/src/lib/api.ts**: use `supabase-browser.ts` for token fetching (consistent with `useAuth`)

## Client Type Relaxations
- `client/src/pages/admin/Orders.tsx`: relaxed type casts to accept extra server fields
- `client/src/pages/admin/Overview.tsx`: relaxed type cast

## Deployment Notes
- If using `npx wrangler dev`, restart after code changes and clear `.wrangler/tmp/*` if stale

## Verification
- Server: `npx tsc --noEmit -p server/tsconfig.json` - passes
- Client: `npx tsc --noEmit` - passes
