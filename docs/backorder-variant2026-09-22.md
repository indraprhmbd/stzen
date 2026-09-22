# Backorder Variant Flag — Vault → On-Demand Fallback at Zero Stock

**Date:** 2026-09-22
**Status:** Approved, implementing
**Prior art:** `variant-model2026-09-02.md` (vault/on_demand type split), this session's research (Shopify `continue selling when out of stock`, Medusa `allow_backorder` — both keep type binary + one orthogonal boolean)

## Problem
Three fulfillment needs, two types:
1. True on-demand — always available, admin types credential per order.
2. True vault — hard stop at zero (`STOK_HABIS`), buyer sees Stok Habis.
3. NEW: vault-backed but must never show Stok Habis — at zero it stays buyable and admin fulfills manually (pool-first when restocked, typed credential otherwise). For chronically low-stock variants.

Rejected alternative: "on-demand that can be stocked". It corrupts type semantics — `getStockCounts` hardcodes 9999 for on_demand (`db-helpers.ts:67`), stock import is rejected server-side (`admin.variants.routes.ts:437`), CSV import errors on on_demand rows (`vault.service.ts:595`), admin list fakes their count (`admin.variants.routes.ts:188`). Flag keeps `vault` = poolable (stock import works unchanged).

## Decision
- `product_variants.allow_backorder boolean NOT NULL DEFAULT false` (per-variant, never product-level).
- `orders.backorder_allowed boolean NOT NULL DEFAULT false`, **frozen at checkout** from the live variant row. Toggling the variant later never retro-changes open orders (user-confirmed).
- Zero-stock backorder storefront shows an honest **Indent badge** (user-confirmed), not silent in-stock.
- On stock import, auto-allocate oldest PAID backorder orders FIFO while pool covers them (user-confirmed); remainder stay PAID awaiting manual credential.

## Behavior matrix
| Variant | Stock | Storefront | Checkout | Approve | Deliver |
|---|---|---|---|---|---|
| vault, flag off | >0 | sellable | ok | allocate → auto DELIVERED | pool |
| vault, flag off | 0 | Stok Habis, hidden | `Out of stock` throw | n/a | n/a |
| vault, flag on | >0 | sellable | ok | allocate → auto DELIVERED | pool first |
| vault, flag on | 0 | sellable + Indent badge | ok, `backorder_allowed=true` frozen | allocate fails → rests PAID (legitimate) | pool if arrived, else manual credential |
| on_demand | — | sellable (unchanged) | unchanged | unchanged | manual credential (unchanged) |

Race safety is free: checkout stock check is advisory; allocation stays atomic (`allocate_credential`, `FOR UPDATE SKIP LOCKED`). Two buyers / one unit: winner auto-delivers, loser becomes a clean backorder instead of `STOK_HABIS`.

## Touch points
1. Migration + `server/db/schema.ts`: both columns.
2. `server/modules/admin/admin.variants.routes.ts` (+zod): allowBackorder in create/update schemas; variant modal checkbox (`useVariantForm.ts` + modal).
3. `server/modules/products/products.service.ts:182,215,309`: sellable `+= || allow_backorder`; `:307` out_of_stock filter excludes backorder-at-0. `getStockCounts` returns real 0 (9999 stays on_demand-only).
4. `server/modules/checkout/checkout.service.ts:86-91`: skip OOS throw when flag on; select `allow_backorder`; freeze onto order.
5. `server/modules/orders/orders.service.ts:599-634` deliver + `:757` approve (unchanged shape): vault & frozen-flag & empty pool → manual-credential branch. Same fallback in `vault.service.ts:replace()`.
6. Restock FIFO: new service fn called from stock-import path; oldest PAID + `backorder_allowed` first.
7. Admin order UI: `useOrderRowActions.ts:145` deliver branch, `types.ts:97` blockedReason, copy strings.
8. Storefront Indent badge (card + detail), ID+EN copy.
9. Tests: checkout skip, deliver fallback, sellable filter, FIFO restock.

## Open follow-up (not in scope)
Pool-preference inside on_demand deliver (drain pool before asking manual credential). Marginal gain, deferred.
