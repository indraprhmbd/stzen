# Cloudflare Deploy Execution

## Context

Repo targets full Cloudflare hosting: Pages frontend, Workers API (Hono 4.13.5), Supabase Postgres plus Auth over HTTP. Prior plan (`cloudflare-workers-deployment-plan-2026-09-06.md`) assumed a Drizzle TCP rewrite. That rewrite already happened through the Supabase client migration: all services use `supabaseAdmin` (`server/shared/db/index.ts`), atomic allocation survives as `supabaseAdmin.rpc('allocate_credential')` (`server/shared/lib/db-helpers.ts:33`). Remaining deploy work is env threading, secret hygiene, SPA fallback, CI repair, and cutover config. Audit date 2026-09-07 against Cloudflare Workers Best Practices (2026-08-20 revision) and Hono Cloudflare Workers docs (2026-09-02 revision). Cloudflare recommendation stands: Workers Static Assets is the default for new full stack apps, but this repo ships Pages plus Worker as separate services (user decision, keeps existing CI shape and independent deploys).

Topology decided:

| Stack   | Production          | Staging                        |
|---------|---------------------|--------------------------------|
| Pages   | `app.<domain>`      | `dev.<domain>`                 |
| Worker  | `api.<domain>` (bare custom domain)    | `*.workers.dev` URL (no route) |
| Supabase| shared project      | shared project, sandbox provider |

Staging shares the Supabase project (cheap, accepted tradeoff: staging rows pollute prod analytics until split).

## Decisions

Secrets committed in plaintext (`server/wrangler.jsonc:8-12`: `SUPABASE_SERVICE_ROLE_KEY`, `AES_SECRET_KEY`, anon key, ngrok origin). Chose rotation plus secret store over history rewrite alone because leaked values stay valid until rotated. Chose to never rotate `AES_SECRET_KEY` because existing `vault_items` rows become undecryptable (data loss, no recovery path). Supabase keys rotate freely (stateless credentials).

`process.env` at request time (`server/app.ts:49`, `server/shared/middleware/auth.ts:25,48`, services) breaks on Workers (no `process.env` by default). Chose `c.env` threading with `process.env` fallback over the `nodejs_compat_populate_process_env` flag because Hono docs name `c.env` canonical and the fallback keeps `tsx` node dev working unchanged. Typed via `wrangler types` (`worker-configuration.d.ts`), catches config drift at compile time.

Rate limiter is per isolate in memory (`server/shared/middleware/ratelimit.ts:12`). Chose to ship it as is because abuse profile is low volume admin plus checkout, and global limiting moves to Cloudflare dashboard Rate Limiting rules post launch (zero code).

Cookie `Secure` hardcoded (`server/modules/auth/auth.routes.ts:72,123`) and HSTS preload (`server/app.ts:29`) break plain HTTP preview. Chose protocol gating (secure only when request is HTTPS or env is production) because OAuth callback must work on `http://localhost` and Pages preview URLs.

Legacy TCP path (`server/db/index.ts`, `postgres` 3.4.5, `drizzle-orm` 0.45.2) stays installed for `drizzle-kit` migrations only. Chose isolation over removal because migrations need the direct connection (`DATABASE_DIRECT_URL`) and schema types feed the whole codebase. Worker bundle must never import it (verified via `wrangler deploy --dry-run` bundle report).

CI Pages job runs `pages project list`, never deploys (`.github/workflows/deploy.yml:41-46`). Chose dashboard Git integration for Pages (preview deployments free, zero workflow code) and keep `wrangler-action@v3` for the Worker only. Migrations run `workflow_dispatch` only, never auto on deploy (forward only, no rollback path).

## Implementation

### Phase 0: secrets triage (manual, before any deploy)

```sh
cd server
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
wrangler secret put AES_SECRET_KEY --env production
wrangler secret put AES_SECRET_KEY --env staging
wrangler secret put PAYMENT_SUMOPOD_API_KEY --env production
wrangler secret put PAYMENT_SUMOPOD_WEBHOOK_SECRET --env production
# sandbox equivalents to --env staging
```

Rotate Supabase anon plus service_role keys in dashboard after storing. Update `server/.dev.vars` (gitignored) for local `wrangler dev`. Strip all secret values from `server/wrangler.jsonc`, keep non secret `vars` (`SUPABASE_URL`, `CORS_ALLOWED_ORIGINS`, `PAYMENT_APP_BASE_URL` per env).

### Phase 1: Worker API readiness

Env snapshot pattern, one place (`server/app.ts`):

```typescript
export interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  AES_SECRET_KEY: string
  CORS_ALLOWED_ORIGINS: string
  PAYMENT_APP_BASE_URL: string
}

export function createApp(env?: Partial<Env>) {
  const get = (k: keyof Env) => env?.[k] ?? process.env[k] ?? ''
  // wire get() into CORS origins, supabase clients, AES key
}
```

`server/workers-entry.ts` passes through:

```typescript
import { createApp } from './app'
export default {
  fetch(request: Request, env: Env) {
    return createApp(env).fetch(request)
  },
}
```

Plus: no `Bindings` generic on the Hono app (`c.env` stays unused, runtime store feeds `getEnv()`, keeps `AuthEnv` middleware typing intact), `Buffer` plus `require('node:crypto')` fallback deleted from `server/shared/lib/publicId.ts` (Workers provides `globalThis.crypto`, `btoa`), `shared/db/workers.ts` deleted (zero imports, duplicate), `@hono/node-server` plus `dotenv` moved to devDependencies (node entry only), `compatibility_date` bumped to ship date, `minify: true`, `env.production` bare custom domain `api.<domain>` (paths and wildcards rejected on custom domains, verified via `--dry-run`) plus `env.staging` without route.

### Phase 2: Pages frontend

`client/public/_redirects` (one line, SPA fallback):

```
/* /index.html 200
```

`client/public/_headers` (immutable chunks, fresh shell):

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/index.html
  Cache-Control: no-store
```

Pages project settings: build `npm run build --workspace=client` (root `build` script runs client `vite build` 6.3.5), output `client/dist`, Node 20. Production env `VITE_API_BASE_URL=https://api.<domain>`, preview env points at staging Worker URL. Attach `app.<domain>` prod, `dev.<domain>` to preview branch. Chunk skew guard (`vite:preloadError` one shot reload) ships as hardening backlog, not blocker.

### Phase 3: CI/CD

Worker job keeps `wrangler-action@v3` with `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`, deploys `--env production` on `push: main`, staging on manual dispatch. Pages deploys via dashboard integration (delete broken Pages job). Migrations job `workflow_dispatch` only: `drizzle-kit migrate` with `DATABASE_DIRECT_URL` secret against direct port 5432.

### Phase 4: provider plus Supabase cutover

Supabase dashboard Auth URL config: site URL `https://app.<domain>`, redirect allowlist `https://app.<domain>/**` plus `https://dev.<domain>/**`, Google provider authorized redirect for both. SumoPod dashboard webhook points at `https://api.<domain>/api/v1/webhooks/sumopod` (verify route path in code before saving). Return URLs derive from per env `PAYMENT_APP_BASE_URL`, no code change. DNS: Worker route `api.<domain>`, Pages CNAME `app` plus `dev`, TLS automatic.

### Phase 5: validation plus rollback

Smoke matrix: catalog load, Google OAuth both domains, sandbox checkout to webhook to PAID, admin approve then deliver, vault unlock then decrypt, stock deep link with order param, hard refresh `/admin/*` plus `/auth/callback` (SPA fallback proof). Rollback: `wrangler rollback` (Worker versions kept), Pages dashboard one click production rollback, DB migrations forward only.

## Open Questions

Hostname `app.<domain>` assumed, apex stays free for later landing. Confirm before DNS commit.

Staging API on `workers.dev` assumed, upgrade to `dev-api.<domain>` route only if staging needs first party cookies or cert parity. Evaluated at staging smoke.

Staging shares Supabase project, analytics pollution accepted. Split to separate project when staging order volume obscures prod metrics.

Starter secrets list may miss provider vars (`PAYMENT_SUMOPOD_METHOD_CODE`, `PAYMENT_SUMOPOD_CAPTURE`, Duitku set). Final sweep is `grep process.env server` before first production deploy, every hit must resolve to `c.env`, secret store, or documented var.
