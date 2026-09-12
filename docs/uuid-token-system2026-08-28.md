# UUID Token System - Hiding Plain UUID (Lightweight Two ID Light)

**Date:** 2026-08-28
**Scope:** products and orders public_id, lightweight, long-term healthy
**Status:** Approved, implementing

## Problem
Internal `id uuid gen_random_uuid()` exposed directly to client in URLs and JSON (`products.id`, `orders.id`). UUID v4 already prevents sequential enumeration, but still leaks internal PK, long 36 chars, and any leaked token can be replayed if auth check missing. Need opaque token that hides plain UUID, short, random, lightweight, best practice aligned.

## Research
* Opacity is not authorization - OWASP IDOR: opaque stops enumeration, auth still mandatory `where owner = auth.uid()`.
* Hashids/Sqids reversible, salt recoverable with <100 pairs (Sjoerd 2023), not crypto, rebranded to Sqids 2023 to drop security claims.
* OWASP recommended: indirect reference map - server random token, store `token → internal_id, owner_id`, resolve with ownership.
* Two ID pattern (Stripe, GitHub, Twilio): internal `uuid/snowflake` for joins + external `NanoID/uuid4` for URLs. ULID leaks timestamp, not wanted.
* For lightweight, single column `public_id` on row is enough - no extra mapping table.

## Decision
Option A single column lightweight Two ID light.

* Keep `id uuid` internal PK for FK and joins.
* Add `products.public_id text unique not null` and `orders.public_id text unique not null` - `nanoid 12` `A-Za-z0-9_-`, 12 chars vs 36, URL safe, 71 bits entropy.
* Vault and profiles stay internal UUID, not exposed long term.
* No Hashids, no AES, no extra table.

## Changes

### 1. DB Migration `add_public_id_products_orders`
```sql
ALTER TABLE products ADD COLUMN public_id text UNIQUE;
ALTER TABLE orders ADD COLUMN public_id text UNIQUE;
CREATE UNIQUE INDEX products_public_id_idx ON products(public_id);
CREATE UNIQUE INDEX orders_public_id_idx ON orders(public_id);
-- Backfill existing 8 products + 5 orders with nanoid 12 via app script, then set NOT NULL
ALTER TABLE products ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN public_id SET NOT NULL;
```

### 2. Drizzle Schema `server/db/schema.ts`
* `products.publicId: text('public_id').notNull().unique()`
* `orders.publicId: text('public_id').notNull().unique()`

### 3. Server Generation Helper `server/shared/lib/nanoid.ts`
* `export const generatePublicId = () => nanoid(12)` - uses `nanoid` 1KB, no DB.

### 4. Services
* `productsService.listActive` select `publicId as id`, expose `id` = `public_id`.
* `productsService.getByPublicId`, `ordersService.getByPublicId`, `ordersService.listByUser` join on `publicId`.
* `adminProducts create` generate `publicId`, `checkoutService.createOrder` generate `publicId`.
* Backfill script loops existing rows, generates id where null.

### 5. Routes
* `GET /api/v1/products/:publicId` param `publicId` -> resolve `where public_id`
* `GET /api/v1/orders/:publicId` and `GET /:publicId/credentials` -> resolve + ownership `404` if not owned
* `admin` `PUT /products/:publicId`, `DELETE /:publicId`, `POST /:publicId/stock`, `POST /orders/:publicId/approve` etc. - param is publicId, internal lookup then action.
* Keep `id uuid` never exposed in JSON.

### 6. Client
* No logic change - `product.id` and `order.id` now opaque `12` char token, treat as opaque. Remove `slice(0,8)` assumptions, display full token or truncated with `…`. All `api` calls use same `id` variable which is now publicId.

## Weight
* 1 text column + 1 unique index per table, no extra table, no crypto per request, nanoid sync generation, bundle +1KB, lookup `unique index log n` same as PK.

## Not Touched
* Vault, profiles, checkout amount logic, auth middleware, RLS, encryption.

## Result
Before: URLs `/orders/15953b81-1ba6-...` 36 chars internal PK exposed.
After: `/orders/Nx7aQp2zK9_A` 12 chars random, internal `uuid` hidden, still 404 on wrong owner, lightweight, long term healthy.

## Steps
1. Add `nanoid` dep, add helper
2. Apply migration, backfill
3. Update schema, update services to generate and resolve public_id
4. Update routes param to publicId
5. Update client display (no slice)
6. Build verify
