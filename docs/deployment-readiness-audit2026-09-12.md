# Deployment Readiness Audit

## Context

Stack: Hono 4.13.5 API on Cloudflare Workers (`store-subs-api`), React 19.1 + Vite 6.3.5 storefront on Cloudflare Pages, Supabase Postgres (project `kqgfbmehepanzkhypzdw`) with Drizzle 0.45.2 migrations, manual checkout plus SumoPod provider scaffold. Calibrated for Supabase Free plan and low traffic: every item is $0 unless marked as a growth trigger. Sources: repo probes (explore subagents, Sep 2026), Cloudflare Workers best practices guide (2026-08-20, `compatibility_date`, `nodejs_compat`, `wrangler types`, secrets, observability, versions/gradual deployments), Supabase production checklist (RLS, SSL, network restrictions, PITR), Supabase CLI reference (`db lint`, `migration`, `link`, `pull`), prior Snyk scans (SCA undici dev-only, SAST clean).

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backup posture | Accept RPO 24h on Free, prove one restore | PITR is Pro-only. A restore rehearsal into scratch converts hope into a plan. Chose rehearsal over upgrade because order volume is dozens per day |
| Pause risk | Operational watch, not technical hack | Free projects pause after 7 idle days. Keep-alive pinging games the platform. Uptime checker doubles as pause detector. Pro $25/mo is the trigger on first incident, not day one |
| Rollout model | 100% deploys, rollback by CI re-run | Gradual deployments (versions API) pay off with revenue traffic. At this scale instant rollback of a known commit is faster to operate |
| Rate limiting layer | Harden in-code limiter now, edge rules later | In-memory per isolate is correct at low traffic. Cloudflare Rate Limiting on first abuse incident, with the code limiter as permanent defense in depth |
| Staging shares prod DB | Keep, with hygiene rules | Separate Supabase project doubles operational surface for zero current benefit. Test-row prefixes plus periodic cleanup contain the risk |
| Lockfile | Commit `package-lock.json` | Gitignored today, so CI can resolve untested minors. Reproducible builds beat clean diffs |

## Phase 0: Pre-deploy Blockers

| # | Item | Evidence | Fix |
|---|---|---|---|
| 1 | Confirm historic secret rotation | Plaintext `SERVICE_ROLE`/`AES` in `wrangler.jsonc` history (`928bb9d`, `373718f`) | Manual: rotate anon plus service_role in Supabase dashboard, re `wrangler secret put` both envs, update Pages env and local `.env`. Never rotate `AES_SECRET_KEY` (vault loss). Gate: `server/scripts/check-secrets.mjs` asserts the 2 runtime-critical secrets (`SUPABASE_SERVICE_ROLE_KEY`, `AES_SECRET_KEY`) per env, plus a dry-run assertion that production CORS contains no dev origins |
| 2 | RLS posture unverifiable | `server/db/migrations/meta/0000_snapshot.json` shows RLS false on all 4 initial tables, zero `CREATE POLICY` in 10 migrations | Manual: export live policies into repo (`supabase db pull`), then run `server/db/rls-verify.sql` matrix (anon, owner, wrong owner, admin) per sensitive table |
| 3 | Bare-deploy footgun | Top-level `wrangler.jsonc` vars equal staging plus ngrok CORS; `server/package.json:10` deploys bare under prod name | Pin `deploy` script to `--env production`. CI guard fails on ngrok or localhost in production vars |
| 4 | Migration runner drift | Journal tracks only `0000`, prod applied via dashboard plus `db:push` | Reconcile `supabase migration list` against remote once. Single runner after: manual `drizzle-kit migrate` (`workflow_dispatch` only) |
| 5 | Pages source of truth | `client/dist` stale (09-06 vs 09-07 headers), Pages config dashboard-only | Never upload `dist` manually, Pages rebuilds on push. Settings recorded in Manual Checklist below |

## Phase 1: Security Hardening (code)

- Rate limit keyed on `cf-connecting-ip` (`server/shared/middleware/ratelimit.ts:16`), coverage extended to `GET /products/*`, `/settings/public`, `/health`. Dedicated 204 CSP-report handler replaces the 404 noise at `server/app.ts:54`.
- `lanOriginPattern` gated on `!isProd()`. Ngrok removed from `server/app.ts:58` fallback so a missing var fails closed.
- Deps: `wrangler` plus `@cloudflare/vite-plugin` to devDeps, unused `postgres` removed, lockfile committed.
- Supabase Auth dashboard (manual): redirect allowlist prod plus staging plus ngrok only, email enumeration protection on, Google provider URLs confirmed.

## Phase 2: Data Safety (Free Tier)

- RPO 24h documented and accepted. One restore rehearsal into scratch, steps plus timing recorded here after the run. Quarterly repeat and after major schema changes.
- Uptime checker (free tier UptimeRobot or Checkly) on `/api/health` plus storefront homepage. Alert target: operator email. Doubles as pause detector.
- Pooling already PgBouncer 6543. Runtime code never touches direct 5432. Migrations use direct port, correct.

## Phase 3: Observability ($0)

- Worker `observability.enabled` true. Existing `[concealed_not_found]`, `[redirect_blocked]`, `[audit]` tags stay the search vocabulary. `wrangler tail --env` after every deploy.
- Supabase saved Log Explorer queries for 5xx spikes and auth failures. Security plus Performance Advisors to zero critical, monthly cadence.
- Post-deploy smoke matrix (staging, then prod): health 200, public settings shape plus cache header, admin 404 matrix identical across no-token/bad-token/customer-token, one manual checkout end to end.

## Phase 4: Release Engineering

- `deploy.yml`: pinned `wranglerVersion`, typecheck job, offline migration lint (`server/scripts/lint-migrations.mjs`: fails on unreviewed destructive SQL), `concurrency.cancel-in-progress: false`, GitHub `production` environment scoping. Snyk stays on-demand per repo rule, run before release tags.
- Flow: manual staging dispatch, smoke, merge to `main`, prod auto-deploy. Rollback equals CI re-run on prior commit.

## Manual Checklist (dashboard clicks, owner operator)

- Supabase: rotation done, RLS export plus verify matrix green, redirect allowlist tight, enumeration protection on, backup restore rehearsed, advisors zero critical
- Cloudflare: Worker secrets present both envs (`check-secrets.mjs`), Pages build settings (`npm run build --workspace=client`, output `client/dist`, Node 20, per-env `VITE_API_BASE_URL`), custom domains plus DNS proxied, uptime checker alerting
- Release: staging smoke green, prod smoke green, `wrangler tail` clean for 10 minutes

## Growth Triggers (decided now, executed later)

Pro $25/mo on first pause incident or data past 4GB. Split staging DB on first prod-data scare. Edge rate limiting on first abuse incident. Gradual deployments with revenue traffic. PITR need equals Pro need.

## Open Questions

Free-tier backup retention exact window unconfirmed in console, verify during rehearsal and record here. Supabase dashboard alert availability on Free unconfirmed, confirm while setting up Phase 3 and adjust.
