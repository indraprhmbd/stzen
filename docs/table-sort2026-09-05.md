# Table Sort, Client-Side + Server-Side, URL Sync

**Date:** 2026-09-05
**Scope:** 1 hook, 1 component update, 5 server routes, 6 client pages
**Status:** Built 2026-09-05

## Context

DataTable has no sorting. User needs sortable columns across all admin tables. Critical concern: client-side sort on server-paginated tables (Orders, History, VaultList) only sorts the current page, which is misleading. Need two modes: client-side for in-memory data, server-side for paginated endpoints.

## Decisions

| Choice | Picked | Rejected | Why |
|---|---|---|---|
| Architecture | Two-mode hook: client-side useMemo + server-side URL params | TanStack Table, single-mode | TanStack is overkill for thin DataTable wrapper. Two modes handle both paginated and non-paginated tables correctly |
| Sort state for paginated tables | URL params (?sort=X&dir=Y) | Component state only | Persists across reload, shareable links, consistent with existing ?status= pattern |
| Sort state for non-paginated tables | Component state (useMemo) | URL params | No pagination, no need for persistence |
| Auto-detection | Sort by data type (number, string, boolean, date) | Require explicit comparator per column | Reduces boilerplate, 90% of columns sort correctly with type detection |
| Null handling | Nulls always last | Nulls first | UX: empty cells shouldn't appear at top of sorted list |
| Sort indicator | Chevron icon (NavArrowDown rotated) | Text arrows, colored indicators | Matches admin soft theme, minimal visual noise |
| Scope | All 6 admin tables | Subset | Consistent UX across all admin views |

## Implementation

### Phase 1: useTableSort hook

`client/src/hooks/useTableSort.ts`:
- `useTableSort<T>(data, opts)` where opts: `{ defaultKey, defaultDir, urlKey?,getId? }`
- Returns `{ sorted, sortKey, sortDir, toggleSort }`
- Two internal paths:
  - `urlKey` provided: read/write URL search params, caller handles pagination reset
  - No `urlKey`: local useState, useMemo sorted output
- Auto-detect comparator: number, string, boolean, Date, nulls-last
- `sortFn` override on column definition for custom comparators

### Phase 2: DataTable sort UI

`client/src/components/admin/DataTable.tsx`:
- Column interface: `{ label, className?, sortKey?, sortFn? }`
- DataTable props: `{ sortKey?, sortDir?, onSort?(key) }`
- Header: clickable when sortKey present, shows NavArrowDown rotated
- Cursor: pointer on sortable headers, default on non-sortable

### Phase 3: Server-side sort

Each paginated endpoint adds `sort` + `dir` query params:

`orders.service.ts`: sort param mapped to ORDER BY column
- `createdAt` (default desc), `amount` (asc/desc), `status` (asc/desc)

`admin.history.routes.ts`: sort param
- `createdAt` (default desc), `action` (asc/desc)

`vault.service.ts`: sort param
- `createdAt` (default desc), `status` (asc/desc)

### Phase 4: Wire up pages

| Page | Mode | URL sync | Default sort |
|---|---|---|---|
| BasisPanel | Client | No | name asc |
| VariantGroups | Client | No | name asc |
| Orders | Server | Yes (?sort) | createdAt desc |
| History | Server | Yes (?sort) | createdAt desc |
| VaultList | Server | Yes (?sort) | createdAt desc |
| Overview tables | None | No | 5 rows, no sort |

## Verification

- Client tsc exit 0
- Server tsc exit 0
- Sorting works on BasisPanel (client-side, instant)
- Sorting works on Orders/History/VaultList (server-side, URL params update)
- Pagination resets to page 0 on sort change
- Non-sortable columns (AKSI) show no click indicator
- Nulls sort last in all columns
