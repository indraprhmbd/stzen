# Performance Optimization Plan: Edge Cache, Counts, Placement (2026-09-12)

Execution plan built on `docs/perf-research2026-09-12.md`. Scope: research items 1, 3, 4, 5 (the low-effort/high-impact set). Item 2 (single Postgres RPC for products+stock) deferred until warm-path latency matters again; items 6 (rate-limit binding/DO) and 7 (ETag) deferred as correctness/nice-to-have.

## Goal

Cut repeat-visit catalog latency to near-zero (cache hits skip the Worker), remove growing-table COUNT scans, and pin the Worker next to Supabase ap-southeast-1 so authenticated endpoints stop paying transcontinental round-trips.

## Changes

### 1. Workers Cache on public reads (research item 1)

- `server/wrangler.jsonc`: enable `"cache": { "enabled": true }`. Cloudflare then consults the cache BEFORE the Worker runs; hits cost zero CPU and zero Supabase queries. `Authorization`-header requests bypass automatically, so admin/authed endpoints are untouched by design. If pinned wrangler 4.129.0 rejects the config key in dry-run, fall back to dashboard Cache Rules and keep the headers (they still control browser caching); document the fallback here.
- Response headers (Cache-Control was previously absent on products):
  - `GET /api/v1/products` (list): `public, max-age=60` + `Cache-Tag: catalog`
  - `GET /api/v1/products/categories`: same
  - `GET /api/v1/products/:id`: same
  - `GET /api/settings/public`: already had `max-age=60, stale-while-revalidate=60`; add `Cache-Tag: settings`
- Staleness contract: catalog may trail reality by up to 60s. Acceptable: stock counts on the storefront are indicative, checkout re-validates allocation atomically (`allocate_credential` RPC).
- Purge-on-write: one middleware on `/api/v1/admin/*` in `server/app.ts` - after any non-GET request completes successfully, fire-and-forget `ctx.cache.purge({ tags: ['catalog', 'settings'] })` via `waitUntil`. This single chokepoint covers every catalog mutation (product/variant CRUD, stock import, approve/deliver/refund stock movement, settings PUT, Danger Zone deletes/deactivates/purges) without touching 13+ handlers. Purge is best-effort: wrapped in try/catch, silently no-ops where the runtime API is unavailable.

### 2. JWKS caching (research item 3) - NO-OP, already satisfied

`createRemoteJWKSet` is held in a module-scope singleton (`server/shared/middleware/auth.ts:22-35`). jose caches fetched keys in memory for the isolate's lifetime and refetches only on an unknown `kid` (rate-limited by cooldown). There is no per-request JWKS fetch to remove. Recorded here so nobody re-implements it.

### 3. `count=exact` to `count=estimated` on growing-table listings (research item 4)

Exact COUNT scans grow forever with table size; `estimated` is exact up to Supabase's `db-max-rows` threshold (default 1000) then falls back to planner stats - pagination UIs stay honest. Changed only where the table grows unbounded and the number feeds a pager/tile:

- `server/modules/orders/orders.service.ts:379` - admin order queue pager total
- `server/modules/admin/admin.history.routes.ts:52` - audit log pager total (grows forever, by design)
- `server/modules/admin/admin.stats.routes.ts:20` - vault AVAILABLE tile (vault grows fastest)
- `server/modules/admin/admin.stats.routes.ts:67` - per-variant low-stock counts (exact under 1000 rows/variant, so behavior unchanged in practice)
- `server/modules/admin/admin.analytics.routes.ts:24` - byStatus group counts (range-bounded, feeds percentages)

Deliberately kept `exact` (safety invariants, small tables): all `danger.service.ts` checks, `admin.products.routes.ts:149` variant delete-guard, per-user `statusCounts` (orders.service.ts:46, 86-88), products tile count.

### 4. Placement hint next to Supabase (research item 5)

`server/wrangler.jsonc`: `"placement": { "region": "aws:ap-southeast-1" }` - deterministic hint running the Worker in the Singapore data center co-located with the database. Docs claim 20-30ms to 1-3ms per origin round-trip; authenticated endpoints still make 1-4 sequential Supabase calls, so this is the largest remaining win for distant-eyeball traffic. Cache hits skip placement entirely (lookup happens before the Worker runs). If wrangler rejects `region` as a hint key, fall back to `"placement": { "mode": "smart" }` and note it here.

## Verification

1. `wrangler deploy --dry-run --env staging` (validates both config keys)
2. Server tsc + tests + migration lint
3. Deploy staging, measure `/api/v1/products` twice (miss then hit), confirm `cf-cache-status` / response time, confirm admin PUT still purges (edit a product, re-fetch within TTL)
4. Confirm authed endpoint (admin stats with JWT) unchanged and no caching of authed responses

## Commit

Single epic commit: `perf(server): edge-cache public reads, estimated counts, placement hint`
