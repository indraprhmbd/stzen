# Sort persistence + server ordering (`sort-persistence-2026-09-13`)

## Problem
Admin table sort looks persistent but lies on paginated tables:
- `admin.orders` list sorts the fetched page in JS (`orders.service.ts:402-422`).
  Page 2 of "sorted by amount" is sorted within itself, not globally.
- `admin.vault` list ignores the `sort` key (only direction applied) and
  filters `q` in memory after `range()` (`vault.service.ts:114-127`) - same
  paging break plus wrong key.
- VariantGroups / BasisPanel sort in memory with zero URL state: refresh or
  shared link loses the sort. (Accepted: server cannot sort computed fields
  like avg/median/group stats, so these stay client-sorted.)
- History is already correct (SQL order) and needs no change.

Storefront reference (`ProductList.tsx:47-160`): URL params
(`category/sort/page/search`, defaults omitted) -> server sorts the full
filtered set -> slice page. Same shape adopted below; admin keeps its own
param names (`sort`/`sort_dir`/offset/limit) - no bookmark breakage.

## Changes

### Phase 1 - server: order before range
- `orders.service.ts` list: replace post-fetch JS `sort()` with query
  `.order()` before `.range()` for keys `createdAt`/`amount`/`status` with
  `sortDir`; keep `oldest=1` ascending behavior. Params unchanged.
- `vault.service.ts` list: honor `sort` key (`createdAt`/`status`,
  default `createdAt` desc) via `.order()` before `.range()`; move `q`
  filtering into the query (ilike on order ref) instead of post-range memory.
- Tests: seed multi-page fixtures, assert global order across pages for
  orders-by-amount and vault-by-status; assert `q` no longer drops rows.

### Phase 2 - client: URL-persisted sort everywhere
- `useTableSort` server mode (`urlKey`) adopted by VaultList (replaces the
  bespoke `useVaultManager` sort state; keeps `asc->desc->reset-to-default`
  + page reset), VariantGroups, BasisPanel (persist key+dir in URL, keep
  `sortByKey` in memory for computed fields).
- `useTableSort` gains storefront-style default-omission: clean URLs stay
  clean when sort returns to default.
- `TableSortMenu` + `DataTable`: no changes (already consume
  `sortKey`/`sortDir`/`toggleSort`).

## Verify
- `npm test --workspace=server` (new ordering tests), `npx tsc --noEmit -p client`,
  `npm run build --workspace=client`, server `tsc` build.
- Manual: Orders sort JUMLAH -> page 2 continues global order; copy URL to
  fresh tab -> same sort+page; mobile menu reflects URL state.
- Untouched: History endpoint, Overview previews, param names, migrations.
