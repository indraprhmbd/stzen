# Fetch Tightening 2026-09-13

## Problem
Network tab shows fat payloads with dead fields on every screen. Audit (2026-09-13)
found 10 hotspots: full-table scans + client filter/sort/paginate, N+1 low-stock
counts, 4-way Overview fanout hitting the same orders window twice.

## Research verdict (Context7 + web, Sep 2026)
- **Tight fetching wins.** Server returns exactly what the screen renders.
  Every unused column costs 4x: serialize, carry, parse, cache.
- TanStack Query `select()` saves re-renders, NOT bandwidth. Supabase
  `.select('a,b')` + `.range()` + `embed(col)` is the server-side fix.
- BFF 2026: thin per-surface aggregation, parallel fan-out, reshape to the
  component tree, no business logic. Our Hono monolith already IS the BFF.
- Offset pagination stays for admin tables (jump-to-page); `limit+1 → hasMore`
  avoids `COUNT(*)`.
- Exceptions (fetch extra OK): shared cache across screens (detail → list via
  `select()` slice), tiny static data (categories, settings, `staleTime` long).

## Rule
**Per-row/per-page data → project server-side. Global/reference data → fetch
once, reuse.** Per-screen column contracts below are the source of truth.

## Column contracts (rendered fields only)

| Screen | Endpoint | Ships after fix |
|---|---|---|
| Catalog cards | `GET /products` | id,name,price,compareAtPrice,badge,overview,category,stockCount,fulfillmentType,isActive |
| Product detail | `GET /products/:id` | full (unchanged) |
| Overview tiles+charts | `GET /admin/overview` (NEW composite) | stats{4}, analytics{4 arrays}, orders[5]{id,productName,customerEmail,amount,status,createdAt}, lowStock{rows[5]{id,name,sku,product_name,stock_count},outOfStock,runningLow} |
| Manual-order dropdown | `GET /admin/variants?compact=1` (NEW) | id,name,price,isActive |

Dropped from list payloads: `description,instructions,createdAt,updatedAt`
(catalog); `userId,paidAt` etc stay on full admin order rows (other tabs use them).

## Changes

1. **Migration `0011_low_stock_rpc.sql`** — `low_stock_variants(p_threshold,
   p_limit)` + `low_stock_summary(p_threshold)`: single `GROUP BY` aggregate
   replacing 1+V count queries. `security definer`, `search_path=public`.
2. **`admin.stats /low-stock`** → 2 RPC calls (rows + summary). Same JSON shape.
3. **NEW `admin.overview.routes.ts` `GET /`** — one round trip: stats(4) +
   analytics(4) + recent orders(5, projected) + low-stock RPC, all in one
   `Promise.all`. Mounts at `/admin/overview` behind existing admin guard.
   `Overview.tsx` switches to the single call, same render shape.
4. **Catalog `listPaginated`** — `category` via `products!inner` + `ilike`
   search + `order` pushed to SQL (newest/price/name). Stock-gate + page slice
   stay in memory on projected rows (`stock`/`out_of_stock` sorts keep the
   current path, leaner rows). Guest `limit=8` already server-side.
5. **`admin/variants?compact=1`** — 4-column select for the manual dropdown.
   `Orders.tsx` adopts it; ProductsPage keeps full rows.

## Non-goals (later)
Dashboard 10s poll → focus-refetch; load-more append; history `select *`
projection; CSV server export; checkout triple-read merge; cursor pagination
for exports. Server `tsc` + tests + client build + workers dry-run per change.
