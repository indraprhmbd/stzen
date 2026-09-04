# Admin POS Production Grade Plan

## Context

Admin dashboard works (Overview, Products, Orders, History) but was built epic by epic with no shared foundation. Each page hand-rolls tables, badges, spinners, toasts, and fetch logic. Stock queries run N+1. Order actions have no idempotency. Single `admin` role. No tests. Goal: production grade dashboard that is reusable, scalable, easy to maintain, secure, and fast, with zero new dependencies and zero new cloud services (cost friendly). Single admin user. No realtime, manual refresh is sufficient.

Stack reference: Hono 4.13.5, React 19.1, Vite 6.3.5, Tailwind 4.3.3, DaisyUI 5.7.22, Drizzle ORM, drizzle-orm 0.45.2, recharts 3.3.0, Supabase PostgreSQL, AES-256-GCM vault, manual bank transfer flow (PENDING to PAID to DELIVERED or REJECTED).

## Decisions

Order A to B to C to D (foundation first, visible value last). Alternatives considered: POS closures first for visible value, rejected because foundation duplication would multiply across new screens.

Single admin role kept. Second role (manager/cashier) deferred, no code reserved for it. Reason: one operator, added RBAC surface unjustified.

No realtime. Manual refresh plus explicit refresh affordance. Polling and Supabase Realtime rejected as unnecessary moving parts for one operator.

Rate limiting in-memory token bucket, not Redis. Reason: zero cost, single instance deploy. Limitation documented: does not share state across instances. Upgrade path is Redis-backed bucket, not built.

Idempotency keys stored as `audit_logs` rows, not a new table and not in-memory LRU. Reason: survives restarts, zero new infra, audit trail is a side effect.

Discount math stays inline client-side (see `client/src/components/ProductCard.tsx`, `discountPct`). No shared client/server package. Reason: three lines, package overhead unjustified.

Copy stays Indonesian-first, extended in existing `client/src/config/copy.ts` `admin` section. No new i18n infra.

RLS posture unchanged. Server connects as `postgres` superuser (bypasses RLS), RLS protects direct client access. No policy changes in this plan.

## Execution notes (2026-09-03, all epics built)

- Variants admin list keeps fetch-all (30-SKU scale). Server pagination applied to orders and history only. Revisit when variants exceed 200 rows.
- `allocate_credential` RPC from AGENTS.md does not exist in code. Deliver is status-only, `vaultItemId` stays null in practice. Refund releases `vaultItemId` when set, nil-safe otherwise.
- Storefront still reads static `brand.config`. Settings table is admin-write only until storefront migration is scheduled.
- Rate limit applied as 60/min admin routes, 30/min checkout. No server login route exists (Supabase handles auth client-side), so login limiting does not apply.
- Admin order search covers name snapshots, payment ref, and product name. UserId excluded (uuid `ilike` unsupported in Postgres).

## Implementation

### Epic A, admin foundation (no API changes)

- A1 `client/src/components/admin/StatCard.tsx`, number plus label plus sub. Replaces Overview statDefs and Produk header stats.
- A2 `client/src/components/admin/StatusChip.tsx`, one status to style map (PENDING, PAID, DELIVERED, REJECTED, AKTIF, stock bands). Replaces per-page badge class strings.
- A3 `client/src/components/admin/DataTable.tsx`, header style, row hover, empty slot. Reused by Products, Orders, History tables.
- A4 `client/src/components/admin/EmptyState.tsx`, `ConfirmDialog.tsx`. Replaces raw `confirm()` in Products and Orders deletes.
- A5 `client/src/hooks/useAdminQuery.ts`, wraps `authedApiRequest` (loading, error, refetch). Migrates Overview off raw `fetch` (`client/src/pages/admin/Overview.tsx`, manual session header). Removes `(as any)` hono client casts via explicit response types.
- A6 Copy pass, hardcoded admin strings into `copy.ts` `admin` section.
- Accept: `vite build` clean, zero `(as any)` in admin pages, visuals identical.

### Epic B, scale (server-first, no new infra)

- B1 Batched stock: `getStockCounts(ids)` in `server/shared/lib/db-helpers.ts`, one `GROUP BY variant_id` query, on_demand maps to 9999 in JS. Rewrites `listActive`, `listPaginated`, admin variants list. Removes ~3N queries per load. Chose GROUP BY over per-row RPC because stock is read-heavy and allocation stays in `allocate_credential` RPC (write path untouched).
- B2 Server pagination on admin orders and variants (`?page&limit&q&status`), History pattern already exists, reuse it. Client `Pagination` component reuse.
- B3 Refresh button plus stale indicator on Orders queue (replaces realtime expectation).
- Accept: one stock query per listing (verify via logs), 400-row seed paginates.

### Epic C, secure (single admin, zero cost)

- C1 Idempotency on order actions: client generates `Idempotency-Key` per click, server checks `audit_logs` before executing, duplicate returns prior result. Fixes double-approve race against `allocate_credential` (`FOR UPDATE SKIP LOCKED` protects rows, not repeated clicks).
- C2 Audit all admin mutations via `appendAudit` (`server/shared/lib/audit.ts`). Stock import already audited, extend to approve, reject, deliver, refund, product and variant writes.
- C3 In-memory token bucket middleware `server/shared/middleware/ratelimit.ts`, login plus admin write routes (30 req/min/IP), `429` plus `Retry-After`. Wired in `server/app.ts`.
- C4 ConfirmDialog (from A4) on destructive actions (delete, reject, refund).
- Accept: double-click approve allocates once, every mutation has audit row, 429s observed under burst.

### Epic D, POS closures

- D1 Manual order create: new admin page, pick variant plus customer identifier, creates PENDING order reusing checkout service logic server-side.
- D2 Refund action: REFUNDED transition plus stock release back to vault (inverse of allocate, terminal state).
- D3 Receipt view: printable order detail (`window.print` CSS).
- D4 CSV export: orders plus variants, client-side generation, zero backend.
- D5 Settings page: bank accounts plus support contacts editable (new `settings` table, public read; storefront `brand.config` migrates to it last).
- D6 Overview range selector (7d/30d/90d) wired to existing `?range=` param.
- Accept: full loop demoable (create to approve to deliver to refund to receipt to CSV).

### Cross-cutting rules (all epics)

Conventional commits per AGENTS.md (`feat(admin):`, `feat(server):`). `vite build` green per epic. ID-first copy, no hardcoded strings. No new npm deps, no new cloud services.

## Open Questions

- Multi-instance deploy date (determines Redis rate limit upgrade timing).
- Second operator role timing (determines RBAC revisit).
- Receipt format requirements (thermal printer widths unknown, screen print assumed).
