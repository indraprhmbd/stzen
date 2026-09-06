# Supabase Migration Regression Fix Plan
**Based on:** `docs/cloudflare-workers-deployment-plan-2026-09-06.md`  
**Date:** 2026-09-06  
**Scope:** Fix behavioral regressions from Drizzle → Supabase client rewrite

---

## Goal
Restore behavior parity with the pre-migration code without reverting to Drizzle.

---

## Fix 1: orders.service.ts — listAll total count

**Regression:** `total` now uses `rows?.length` (page length) instead of a separate COUNT query.

**Fix:** Add a parallel COUNT query with the same filters, or compute total from unfiltered count before pagination.

**Location:** `server/modules/orders/orders.service.ts:256-338`

---

## Fix 2: orders.service.ts — listAll search coverage

**Regression:** Search no longer covers `products.name` or `profiles.email`.

**Fix:** Either fetch orders with joined `products` and `profiles` and filter in JS, or accept the reduced search scope.

**Location:** `server/modules/orders/orders.service.ts:270-277`

---

## Fix 3: products.service.ts — listPaginated total count

**Regression:** `total` uses `withStock.length` after stock filtering, not the DB count.

**Fix:** Run a COUNT query before applying stock/sort filters, or compute from the unfiltered result set.

**Location:** `server/modules/products/products.service.ts:101-148`

---

## Fix 4: products.service.ts — getCategoryCounts sellable filter

**Regression:** Dropped `hasStock`/`on_demand` filter; now counts all active variants.

**Fix:** Re-add the sellable filter: include `on_demand` variants plus variants with AVAILABLE stock.

**Location:** `server/modules/products/products.service.ts:45-71`

---

## Fix 5: vault.service.ts — replace atomicity

**Regression:** Removed `db.transaction()` with `FOR UPDATE SKIP LOCKED`; now does sequential updates that can double-allocate under concurrency.

**Fix:** Create a Supabase RPC function `replace_order_credential` that wraps the revoke→pick→sell→update in a single transaction with `FOR UPDATE SKIP LOCKED`. Call it via `supabaseAdmin.rpc()`.

**Location:** `server/modules/vault/vault.service.ts:208-239`

**DB migration required:** Yes — add `replace_order_credential(variant_id uuid, order_id uuid)` function.

---

## Fix 6: products.service.ts — listActive ORDER BY

**Regression:** Lost explicit `ORDER BY products.category, productVariants.name`.

**Fix:** Add `.order('products.category', { ascending: true }).order('name', { ascending: true })` or sort in JS.

**Location:** `server/modules/products/products.service.ts:12-43`

---

## Fix 7: vault.service.ts — listByVariant orderQuery

**Regression:** `orderQuery` ILIKE on `orders.publicId` is now unimplemented.

**Fix:** Fetch vault items with joined `orders` and filter in JS, or accept the reduced search scope.

**Location:** `server/modules/vault/vault.service.ts:82-143`

---

## Fix 8: orders.service.ts — listAll sort performance

**Regression:** Sort by `amount`/`status` now happens in JS instead of SQL.

**Fix:** Acceptable for now; monitor at scale. If needed, pre-sort in SQL for `newest`/`oldest` and sort in JS only for computed fields.

**Location:** `server/modules/orders/orders.service.ts:117-138`

---

## Order of Execution
1. Fix 5 (vault.replace atomicity) — highest risk for data integrity
2. Fix 1 + Fix 3 (pagination counts) — highest user impact
3. Fix 2 + Fix 7 (search coverage) — medium impact
4. Fix 4 (category counts sellable filter) — medium impact
5. Fix 6 (listActive ORDER BY) — low impact
6. Fix 8 (sort performance) — monitor, fix only if needed

---

## Out of Scope
- Reverting to Drizzle ORM
- Changing the Supabase client approach
- Modifying the frontend
