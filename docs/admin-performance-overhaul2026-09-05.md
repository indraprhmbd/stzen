# Admin Performance Overhaul, DB Cost, Skeleton Loading, UX Fixes

**Date:** 2026-09-05
**Scope:** ~14 files, 1 migration
**Status:** Built 2026-09-05, server + client tsc 0 errors

## Context

Audit revealed: topProducts query ignores range param, Overview fetches all products for 5 low-stock items, analytics runs 4 queries serially, products endpoint runs 3 queries with 2 redundant, vault listByVariant runs redundant count query, history ILIKE full table scan, no skeleton loading anywhere, vault search no debounce, CSV export truncates silently.

## Decisions

| Choice | Picked | Rejected | Why |
|---|---|---|---|
| Loading states | Skeleton rows matching DataTable columns | Keep spinners, add shimmer only | Skeleton eliminates layout shift, costs nothing server side |
| Analytics parallel | Promise.all for 4 independent queries | Keep serial, add cache | 4x latency reduction, queries are independent |
| Low stock endpoint | Dedicated stats/low-stock with LIMIT | Keep full product fetch + client filter | Overview was fetching all products just for 5 rows |
| StatusCounts cache | Module scope 30s TTL | Redis, no cache | Simple, single process, 30s stale window acceptable for badge counts |
| History index | GIN trigram for ILIKE | Prefix-only search | Operator expects substring search on audit logs |
| Vault count | Derive from GROUP BY result | Keep 2 queries | Same data, one less round trip |
| Search debounce | 300ms useDebounce hook | Instant | Prevents per-keystroke API calls |

## Implementation

### Phase 1: Server DB fixes

`admin.analytics.routes.ts`: topProducts uses `days` variable instead of hardcoded 30. All 4 queries wrapped in Promise.all.

`admin.products.routes.ts`: Remove redundant internalId mapping query (line 45-47). Derive map from listAll result.

`products.service.ts`: listAll SELECT explicit columns (no instructions). New lowStock(threshold, limit) method for overview.

`orders.service.ts`: Module scope statusCountsCache with 30s TTL. Parallelize data + count queries.

`vault.service.ts`: Remove redundant total count query. Derive total from byStatus sum.

`admin.history.routes.ts`: Parallelize data + count. GIN trigram index on audit_logs for ILIKE search.

`admin.stats.routes.ts`: New GET /admin/stats/low-stock?threshold=5 returning top N items with stock counts.

### Phase 2: Migration

`0004_admin_indexes.sql`: GIN trigram extension + index on audit_logs for search performance.

### Phase 3: Client UX

`components/admin/TableSkeleton.tsx`: 5 animated gray bars matching DataTable column structure.

`useVaultManager.ts`: 300ms debounce on search q.

`Orders.tsx`: CSV export warning when total > 1000.

`Overview.tsx`: Fetch from new low-stock endpoint instead of all products.

All 4 admin pages: Replace spinner with TableSkeleton during loading.

## Verification

- Server tsc exit 0
- Client tsc exit 0
- No regressions in existing API contracts (additive only)
