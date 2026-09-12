# STZEN - Credential Storefront

[![Deploy to Cloudflare](https://github.com/indraprhmbd/stzen/actions/workflows/deploy.yml/badge.svg)](https://github.com/indraprhmbd/stzen/actions/workflows/deploy.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/API-Hono_4-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![React](https://img.shields.io/badge/SPA-React_19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/DB-Supabase_Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Edge-Cloudflare_Workers-F6821F?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Node 20](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

Digital storefront for subscription credentials (streaming accounts, top-ups, and
similar goods). Buyers browse a public catalog, check out with manual payment
verification, and receive AES-256-GCM encrypted credentials in their dashboard.
Operators run the whole shop from a concealed admin panel: order queue, vault
stock, analytics, settings, and a tiered Danger Zone for destructive actions.

Live: storefront `https://stzen.web.id` · API `https://api.stzen.web.id`
Staging: `https://dev.stzen.web.id`

## Stack

| Layer | Choice |
|---|---|
| API | Hono 4 on Cloudflare Workers (`store-subs-api`) |
| Storefront + admin SPA | React 19 + Vite 6 + DaisyUI 5 on Cloudflare Pages |
| Database + Auth | Supabase Postgres + Supabase Auth (JWT, JWKS verification) |
| ORM / migrations | Drizzle ORM (`drizzle-kit migrate`, forward-only) |
| Language | TypeScript strict, end-to-end types via `hono/client` (`AppType`) |

## Architecture

Modular monolith. The server composes self-contained feature modules; modules
may only import from `shared/` (DB, middleware, errors, crypto) and talk to
each other through public service APIs. Route handlers stay thin and delegate
to services, which throw typed `AppError`s handled by one global handler.

```
server/
  app.ts                 createApp() factory + AppType export
  index.ts               local entry (tsx); workers-entry.ts for Workers
  shared/                db · middleware/auth · errors · lib (crypto, audit)
  modules/               products · orders · checkout · vault · admin ·
                         payments · danger
  db/                    drizzle schema · migrations · rls-verify.sql
  scripts/               check-secrets.mjs · lint-migrations.mjs
client/src/
  pages/                 Catalog · ProductDetail · Dashboard · admin/*
  features/products/     admin product/variant/stock management
  lib/                   hono client · supabase · receipt printer
```

API routes are versioned (`/api/v1/*`); `/api/health` and
`/api/settings/public` are unversioned infrastructure endpoints.

## Local setup

Prerequisites: Node 20+, npm, a Supabase project, Wrangler authenticated
(`wrangler login`) for Worker deploys.

```bash
npm install

# 1. Environment files (all gitignored; .example files show the shape)
cp server/.dev.vars.example server/.dev.vars   # wrangler dev bindings
# then fill: server/.env, server/.dev.vars, client/.env

# 2. Database
npm run db:migrate --workspace=server   # or db:push for iteration

# 3. Run (three terminals, or npm run dev for server+client)
npm run dev:server          # tsx on :3000 (fast iteration)
npm run dev:workers --workspace=server  # wrangler dev on :8787 (real Workers runtime)
npm run dev:client          # vite on :5173, /api proxied to the API
```

Use tsx for speed, `wrangler dev` for truth: anything bound for staging gets
its final check under the real Workers runtime. LAN phone testing works out
of the box (same-origin `/api` + dev-only LAN CORS).

## Environment reference (names only, never commit values)

| File / store | Keys |
|---|---|
| `server/wrangler.jsonc` vars (committed) | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable, public by design), `ENV`, `CORS_ALLOWED_ORIGINS`, `PAYMENT_*` non-secret config |
| Wrangler secret store (per env) | `SUPABASE_SERVICE_ROLE_KEY`, `AES_SECRET_KEY`, provider keys |
| `client/.env` + Pages env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, `VITE_WHATSAPP_NUMBER` |

`npm run deploy --workspace=server` pins `--env production` and runs
`check-secrets.mjs` first (required secrets present, production CORS free of
dev origins). Never bare `wrangler deploy`.

## Deploy flow

1. `workflow_dispatch` staging deploy → smoke on `dev.stzen.web.id`.
2. Merge to `main` → CI typechecks, lints migrations, deploys the Worker to
   production. Pages rebuilds the storefront on push.
3. Migrations are manual-only (`workflow_dispatch`), forward-only.
4. Rollback = CI re-run on the prior commit.

## Security model

- **Credentials encrypted at rest** (AES-256-GCM in `vault_items`), decrypted
  only inside authenticated handlers for the order owner. The AES key is
  never rotated (rotation = vault loss) and never committed.
- **Atomic allocation**: `allocate_credential()` RPC with
  `FOR UPDATE SKIP LOCKED`, never allocate in JS memory.
- **RLS**: profiles/products/orders scoped to owners, catalog public for
  active rows, `vault_items`/`audit_logs`/`settings`/`idempotency_claims`
  server-only (RLS on, zero policies). Verify anytime:
  run `server/db/rls-verify.sql` in the SQL editor.
- **Concealed admin**: `/api/v1/admin/*` and `/admin*` return 404 (not 401/403)
  for missing, bad, or wrong-role tokens.
- **Danger Zone** (admin settings): tiered destructive ops with preview-first,
  typed-phrase confirm, password re-auth, export-gated purge, everything
  audited. Catalog deletes are deactivate-first; orders are never deleted
  (10-year bookkeeping retention under Indonesia UU KUP Pasal 28).
- **Rate limits**: strict bucket on `/admin/danger/*`, coverage on public
  reads, in-memory per isolate (edge rules are the growth trigger).

## Scripts

| Command | What |
|---|---|
| `npm run dev` | tsx API + vite client |
| `npm run deploy --workspace=server` | guarded production Worker deploy |
| `npm run lint:migrations --workspace=server` | offline destructive-SQL lint |
| `npm test --workspace=server` | unit tests |

Conventions: conventional commits (`feat(server): …`), docs live in `docs/`,
AGENTS.md holds the full coding contract.

## License

GNU Affero General Public License v3.0 - see [LICENSE](LICENSE). Hosted or
distributed modifications must share source under the same terms.
