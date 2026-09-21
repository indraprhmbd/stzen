# Profit Tracking (harga jual / harga beli / laba) — 2026-09-21

## Rule (locked by owner)

`product price always get fresh data -> valid order -> immutable record ->
ringkasan get it datetime scopes.`

- Variant holds live prices. Order freezes snapshots at creation.
- While PENDING, manual price edits may rewrite `profit_at_purchase`
  (cost snapshot stays frozen). Once PAID, snapshots are never touched.
- Ringkasan sums snapshots only, never live variant prices.
- No backfill: pre-feature orders have NULL profit, contribute omzet only.
- NULL cost = unknown, excluded from profit (never fake 100% margin).
- Cost is admin-only. Never in storefront projections.

## Schema (migration 0024)

- `product_variants.cost_price integer NULL` — harga beli / modal.
- `orders.cost_at_purchase integer NULL` — frozen at creation.
- `orders.profit_at_purchase integer NULL` — frozen at creation,
  recomputed on PENDING amount edits, locked at PAID.

## Write paths

| Path | price_at_purchase | cost_at_purchase | profit_at_purchase |
|---|---|---|---|
| Checkout creation | amount | variant.cost_price (may be NULL) | cost NULL ? NULL : amount − cost |
| approve-manual (PENDING) | new amount | untouched | cost NULL ? NULL : newAmount − cost |
| Approve webhook/manual, deliver, refund | — | — | — (locked) |

## Variant form

- `VariantDialog`: "Harga beli (modal)" optional integer ≥ 0 under Harga jual.
  Hint: `Kosong = tak dihitung di laba`.
- Varian bulk import: optional `cost` / `harga_beli` column, same NULL rule.
- Editing cost later affects new orders only. No cascade.

## Ringkasan (Overview)

- Hero tile `Pendapatan` → **`Omzet`** (same PAID+DELIVERED sum).
- New **`Keuntungan`** hero tile beside it (sum `profit_at_purchase`,
  NULLs skipped, shares eye-mask + `admin:showRevenue` pref).
- `dailySales` entries gain `profit`.
- `Pendapatan` chart → single dual-line diagram: omzet Area + keuntungan
  Area, distinct colors + legend. Count chart untouched.
- Scope fix: chart revenue/profit lines use PAID+DELIVERED scope like the
  tile (`count` keeps all-statuses as before).

## Tests

- Creation with cost → profit = amount − cost.
- Creation without cost → both NULL.
- approve-manual amount edit recomputes profit, keeps frozen cost.
- Post-PAID paths never write snapshots.
- Overview sums skip NULL profits.
