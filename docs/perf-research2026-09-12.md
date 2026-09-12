# Performance Research: Workers API + Supabase REST (2026-09-12)

## Context

Stack: Hono 4 API on Cloudflare Workers (free plan, `store-subs-api`, prod `api.stzen.web.id`), React SPA on Pages, Supabase Postgres `ap-southeast-1` accessed only via supabase-js 2.x REST with service_role server-side, JWKS auth middleware, AES-256-GCM decrypt on order delivery. Measured: `/api/health` 200-800ms; `/api/v1/products` was 15-75s from ~150 sequential supabase-js fetches (per-variant stock) choking on the 6-simultaneous-connection limit; fixed by one aggregated query, now 250-340ms warm / ~1.4s cold. This doc maps the remaining concrete wins for this exact architecture, primary-source verified on 2026-09-12.

## Findings

### 1. Workers free-plan limits that matter

Source: https://developers.cloudflare.com/workers/platform/limits/ (page updated Sep 5, 2026)

- Simultaneous outgoing connections: **6 per request/invocation, on BOTH Free and Paid plans**. Counts `fetch()`, KV, Cache API, R2, Queues, `connect()` while waiting for response headers; once headers arrive the connection no longer counts; a 7th attempt queues. This was the root cause of the 15-75s catalog: 150 sequential supabase-js fetches each holding a header-wait slot. Service bindings share the same top-level limit.
- Subrequests: **50 per invocation (Free), 10,000 (Paid)**. Each `fetch()` counts; redirect chains count too. Cache API calls share this quota (50 calls/request on Free). So the old per-variant fetch loop was also headed for the 50-subrequest cap, not just the connection cap.
- CPU time: **10 ms per HTTP request (Free); 5 min cap, 30 s default (Paid)**. CPU time excludes waiting on network (`fetch()`, KV, DB). Cloudflare states the average Worker uses ~2.2 ms and "heavier workloads that handle authentication ... typically use 10-20 ms". Implication: JWKS signature verify + AES-256-GCM decrypt per request sits right at the 10 ms Free ceiling; sustained overshoot returns Error 1102 (`exceededCpu`). WebCrypto AES-GCM/ECDSA in workerd is native and fast; pure-JS crypto would blow the budget. Free plan has some built-in flexibility for infrequent spikes, but consistently exceeding terminates the invocation.
- Other relevant: 128 MB memory per isolate; 1 s startup (global-scope work counts); no wall-clock duration limit for HTTP while client connected; `ctx.waitUntil()` extends up to 30 s; 100,000 requests/day (Free) with error 1027 past it.

### 2. PostgREST query cost patterns

Sources: https://postgrest.org/en/stable/references/api/pagination_count.html, https://postgrest.org/en/stable/references/api/tables_views.html, https://postgrest.org/en/stable/references/api/resource_embedding.html, https://postgrest.org/en/stable/references/api/preferences.html

- `Prefer: count=exact` runs a full COUNT aggregate; PostgREST docs state "the larger the table the slower this query runs in the database". Applied to admin order queues or `vault_items` listings, exact count cost grows with table size forever.
- `Prefer: count=planned` uses PostgreSQL planner statistics - fast, accuracy depends on `ANALYZE` freshness.
- `Prefer: count=estimated` does exact count up to the `db-max-rows` threshold, then falls back to planned - best of both for pagination UIs. supabase-js `.count(value)` maps to this Prefer header.
- A plain `HEAD` request on a table route skips the aggregate entirely (PostgREST optimization: "the generated query won't execute an aggregate") - but only when no count preference is requested.
- Resource embedding: PostgREST includes related resources in a single API call using foreign-key joins; the docs frame it explicitly as reducing the number of API requests. One embedding query beats N child fetches both in HTTP round-trips and in single-statement SQL execution.
- Single RPC returning products + variant stock vs 3 fetches: each supabase-js call is one HTTPS round-trip Worker -> Supabase (Supabase does not publish per-region latency numbers; exact ms saving unconfirmed). Conceptually one RPC saves 2 full round-trips plus 2 PostgREST request cycles (auth/schema-cache/parsing), uses 1 of the 50 subrequest slots instead of 3, and lets Postgres do the aggregation (WHERE/GROUP BY) instead of shipping rows to the Worker.

### 3. Edge caching for public GET endpoints

Two mechanisms; both Free-plan usable.

A. **Workers Cache** (new; https://developers.cloudflare.com/workers/cache/, page updated Jul 21, 2026): enable `"cache": { "enabled": true }` in wrangler config; return `Cache-Control: public, max-age=...` on responses. Cloudflare then checks the cache **before** running the Worker - on a hit your Worker (and its Supabase fetches) never execute, and "CPU time is only billed when your Worker runs". Tiered cache (lower tier near eyeball + upper tier aggregating network) is automatic; request collapsing means a cold burst runs the Worker once per data center. Purge-on-write: tag responses with `Cache-Tag` (e.g. `catalog`) and call `ctx.cache.purge({ tags: ["catalog"] })` from admin write handlers. GET/HEAD only; requests with an `Authorization` header bypass automatically (authed endpoints unaffected); `Set-Cookie` responses bypass; cache keys include the Worker version by default (deploys invalidate). The docs quickstart shows it working on `*.workers.dev`. Pricing: standard request rate still billed on hits, CPU is not.

B. **Cache API** (`caches.default`, https://developers.cloudflare.com/workers/runtime-apis/cache/, updated Aug 14, 2026; https://developers.cloudflare.com/workers/reference/how-the-cache-works/): programmatic put/match/delete. Per-data-center only (never replicated, not tiered-cache compatible); `cache.delete()` purges only the local data center - global purge needs the zone purge API with `Cache-Tag`, and the purge target is the subrequest URL, not the Worker URL. `cache.match()` honors `If-None-Match`/`ETag` and `If-Modified-Since` out of the box; `stale-while-revalidate` is not supported on put/match; `Set-Cookie` responses are never cached. Docs say Workers deployed to custom domains have functional cache operations (implication for the staging `*.workers.dev` URL: cache behavior there unconfirmed). Cache API calls count against the 50/request Free subrequest quota.

Typical pattern for this app: Workers Cache with `max-age=60-300` + `Cache-Tag: catalog` on `/api/v1/products` and public settings, purge by tag inside admin product-write handlers; short TTL acts as the safety net if a purge path is missed.

### 4. supabase-js client reuse and connections on Workers

- `createClient()` produces a stateless REST wrapper (fetch under the hood). Holding it at module scope means one client per isolate, created once per cold start; there is no HTTP connection pool inside supabase-js itself. postgrest-js was archived into the supabase-js monorepo on Jan 23, 2026 (https://github.com/supabase/postgrest-js, https://github.com/supabase/supabase-js/tree/master/packages/core/postgrest-js).
- Supabase's serverless guidance (https://supabase.com/docs/guides/database/connecting-to-postgres) is "create the client once at module scope, not per request" - stated for direct-pg drivers, but the same isolation-level reuse applies to the REST client; a per-request `createClient` only wastes cold-path work.
- Whether workerd reuses/pools TCP+TLS+HTTP/2 connections to `*.supabase.co` across fetches: transport-level behavior of the runtime; not documented on the pages reviewed - **unconfirmed**. Practically, module-scope client + fewest fetches is the only lever documented on either side.
- No Supabase-documented gotchas exist for calling the REST API from Cloudflare Workers specifically; Supabase's own "Serverless drivers" note (same page) covers Cloudflare Workers for the direct-pg path only (see out-of-scope).

### 5. Smart Placement / Placement Hints

Source: https://developers.cloudflare.com/workers/configuration/placement/ (page updated Apr 23, 2026)

- "Smart Placement is available on all Workers plans" - **including Free**.
- `mode = "smart"`: automatic analysis (up to ~15 min, needs consistent multi-location traffic; status via API or `cf-placement` header). Best when backends are unknown/distributed.
- Placement Hints fit this app better: single known backend. `placement.region = "aws:ap-southeast-1"` (Supabase ap-southeast-1 is AWS Singapore) deterministically runs the Worker in the lowest-latency data center to that region. Docs claim hints reduce per-query round-trip latency "from 20 to 30 milliseconds per query to 1 to 3 milliseconds".
- Expected gain: this app's authenticated endpoints still make 1-4 sequential Supabase round-trips (JWKS fetch, profile/order reads, decrypt+deliver). At a global eyeball, each origin round-trip is a transcontinental RTT; placement collapses those to single-digit ms. After the catalog fix, the remaining absolute win is on authed/dynamic endpoints, and it shrinks further once edge caching absorbs catalog traffic. Note: with Workers Cache enabled, cache lookups happen before placement, so hits never pay the placement hop.

### 6. In-memory rate limiting on Workers

- A module-level Map is per-isolate and per-data-center: isolates evict at will (memory pressure, deploys, runtime updates), so counters reset silently and limits differ per colo. Correctness problem, not a perf problem.
- **Rate Limiting binding** (https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/, updated Apr 23, 2026): declarative binding, `env.LIMITER.limit({ key })`, periods of 10 or 60 s only. Counters are local-cached and updated asynchronously - "permissive, eventually consistent", per Cloudflare **location** (per colo), zero added latency. The docs page states no plan restriction (as of that page date); Free-plan availability is therefore likely but not explicitly stated - unconfirmed. Hono middleware integrations exist (linked from the docs: `@elithrar/workers-hono-rate-limit`, `hono-cf-rate-limit`).
- **Workers KV** is a poor counter store: eventually consistent "up to 60 seconds or more", 1 write/sec to the same key, 1,000 writes/day on Free (https://developers.cloudflare.com/kv/concepts/how-kv-works/, https://developers.cloudflare.com/kv/platform/limits/).
- **Durable Objects are now available on the Free plan** (https://developers.cloudflare.com/durable-objects/platform/pricing/, updated Aug 25, 2026) - SQLite-backed classes only. Free tier: 100k requests/day, 13k GB-s duration/day, 5M rows read/day, 100k rows written/day. A single global counter DO is viable on Free and gives strong consistency + per-key accuracy the binding lacks. This retires the old "DO is paid-only" assumption.

### 7. Other high-signal items

- **JWKS caching** (https://supabase.com/docs/guides/auth/signing-keys): the `.well-known/jwks.json` discovery endpoint is cached by Supabase's edge for 10 minutes; Supabase client libraries may cache keys in memory for another 10 minutes; the multi-level cache is cleared every 20 minutes. Caching JWKS in Worker module scope with a ~10 min TTL (plus refetch-on-unknown-`kid`) is aligned with Supabase's own caching envelope and removes one outbound fetch from every authed request - directly relieving the 6-connection slot pressure. Rotating ES256 keys (Supabase recommends P-256/ES256 over RSA: faster verification, much shorter signatures) reduces per-request verify CPU on the 10 ms Free budget.
- **ETag/If-None-Match**: `cache.match()` in the Cache API evaluates `If-None-Match` against stored ETags automatically (https://developers.cloudflare.com/workers/runtime-apis/cache/); Workers Cache implements RFC 9111 conditional handling. A static content-hash ETag on the catalog response gives free 304s to clients without a second Supabase query.
- **Compression is automatic at the CF edge**: gzip/Brotli/Zstandard for `application/json` and friends, applied to 200 responses over min sizes (48 B gzip / 50 B br/zstd); on the Free plan default is Zstandard (https://developers.cloudflare.com/speed/optimization/content/compression/, updated Apr 17, 2026). Do nothing; do not hand-roll gzip in the Worker.
- **`select=` column pruning** is a documented cost lever: "when certain columns are wide ... it is more efficient for the server to withhold them" (https://postgrest.org/en/stable/references/api/tables_views.html). JSON arrow extraction (`json_data->field`) narrows payloads further. Worth auditing remaining `select=*` calls server-side, especially on wide product/content rows.
- **PostgREST EXPLAIN**: `Accept: application/vnd.pgrst.plan` returns the query plan through the REST layer, for verifying index usage of hot filters without DB shell access (https://postgrest.org/en/stable/references/api/tables_views.html).

## Ranked improvement list

| # | Improvement | Expected impact for this app | Effort | Plan constraint |
|---|-------------|------------------------------|--------|-----------------|
| 1 | Workers Cache on public GETs (`cache.enabled`, `Cache-Control: public, max-age=60-300`, `Cache-Tag: catalog`, `ctx.cache.purge({tags})` in admin writes) | Cache hits skip the Worker entirely: zero Supabase queries, zero CPU; tiered cache + request collapsing absorb catalog traffic globally; cold misses unchanged | Low | Free OK |
| 2 | Single Postgres RPC (SECURITY DEFINER) returning products + variants + stock in one round-trip | 3 REST fetches -> 1 on cold catalog misses: saves 2 Supabase RTTs + 2 PostgREST cycles + 2 subrequest slots; directly protects the remaining ~250ms warm path | Medium | Free OK |
| 3 | JWKS module-scope cache, ~10 min TTL, refetch on unknown kid | Removes 1 outbound fetch per authed request; relieves 6-connection slot contention on authed endpoints | Low | Free OK |
| 4 | Replace `count=exact` with `count=estimated` (or omit) on orders/vault listings | Kills growing exact-COUNT scans as orders/vault_items grow; keeps pagination UI accurate via db-max-rows threshold | Low | Free OK |
| 5 | Placement hint `region = "aws:ap-southeast-1"` (fallback: smart mode) | All residual dynamic endpoints drop origin RTT toward ~1-3ms/round-trip; biggest for distant-eyeball authed traffic | Config-only | Free OK (all plans) |
| 6 | Rate limiting binding, or SQLite-backed DO counter if strict global limits needed | Correctness under isolate eviction/colo split, not latency; removes silent limit resets | Low-Med | Free OK (DO free tier; binding Free-plan availability unconfirmed) |
| 7 | Content-hash ETag on catalog responses | Free 304 revalidations for repeat clients; supported by cache.match/Workers Cache conditional handling | Low | Free OK |

## Explicitly out of scope (considered and rejected)

- **Direct Postgres connection via the transaction pooler (port 6543) from Workers.** Supabase's connection guide (https://supabase.com/docs/guides/database/connecting-to-postgres) does recommend transaction-mode pooling for "serverless or edge functions" and its serverless-drivers note covers Cloudflare Workers - but that path requires TCP sockets (Workers `connect()` or Hyperdrive), disables prepared statements, drops session state, and shifts pooling correctness (max: 1 per isolate, stale-socket handling) onto us. Workers wall-clock has no duration limit, so the classic "hold a connection per request" motivation is weak here.
- **Why REST stays preferable for this codebase**: PostgREST calls are stateless HTTPS - they work within the documented 6-connection envelope, need no pooler configuration, keep Drizzle as types-only, and every performance problem REST has is solvable at the query-shape/cache layer (sections 2-3). Direct pg would mainly buy arbitrary SQL, which is already available where it matters via Postgres RPC functions through PostgREST.
- **Hyperdrive** (https://developers.cloudflare.com/hyperdrive/): accelerates TCP database connections, not the HTTPS/PostgREST path; no benefit to a supabase-js REST architecture.
- **Paid-plan upgrades** (higher CPU/subrequest caps): documented limits (10ms CPU, 50 subrequests) are not currently the binding constraint after the batching fix; revisit only if catalog RPC + caching still leaves authed endpoints CPU-bound.
