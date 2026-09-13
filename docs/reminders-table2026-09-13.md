# Pengingat Table Redesign (stateful, mobile-first)

Date: 2026-09-13. Replaces the backfill-card design (docs/reminders-agnostic2026-09-13.md).

## Decision log
- Toggle is two-state and mirrors Google truth: ON = event exists,
  OFF = event deleted. No local-only disabled state (drift risk).
- Backfill card removed. Its job dissolves into filter Belum + select-all
  + bulk schedule. Backfill route/schema/service deleted (feature young,
  stack unpushed).
- Toggle state persisted on `orders` (migration 0014): `reminder_state`
  text CHECK (none|scheduled) DEFAULT none + `reminder_scheduled_at`.
  Auto-flow and manual toggles share one writer (reminders.service), so
  the column never drifts from dispatch results.

## Server
- `GET /preview?limit&offset&sort&sortDir&state&q` -> `{ rows, total }`.
  Sort keys: paidAt, expiry, product. SQL order-before-range (sort-persistence
  convention). `state` filters on reminder_state; `q` ilikes public_id /
  variant snapshot / base name. Duration fallback stays batched (2 queries).
- `POST /:id/schedule`, `POST /:id/cancel` -> `{ state }`. Load via
  ordersService.getById, dispatch, write state, audit. Rows without
  computable expiry reject with 400 + reason (client disables toggle).
- `POST /bulk { ids[<=20], action }` -> per-id results, sequential dispatch
  (20 x ~2 subrequests worst case < 50 cap).
- State writer rule: scheduled iff any provider ok; scheduled_at=now on
  schedule, null on cancel. Failures keep old state + audit.

## Client (mobile-first)
- Route/nav unchanged (/admin/reminders, sidebar, bottom nav).
- Filter row stacks on mobile (flex-col like History): state `ad-seg` tabs
  (Semua/Belum/Terjadwal) + search input + TableSortMenu (mobile sort).
- Columns: select | ORDER | PRODUK | STATUS(hidden md-) | BAYAR(hidden md-)
  | KADALUARSA | toggle. DataTable `Column.className` hides low-value cells
  below md; data-labels keep working for visible cells. Mobile card order:
  checkbox+order+toggle stay visible; produk/kadaluarsa labeled rows.
- Toggle: DaisyUI `toggle` (touch-sized), optimistic flip, per-row busy,
  rollback + inline error on failure, disabled + reason tooltip when no expiry.
- Bulk bar renders only when selection non-empty, above table; buttons
  full-width stacked on mobile. Header checkbox selects current page only.
- Pagination via TablePagination; page/offset reset on filter/sort change
  (useTableSort server mode already wipes page/offset on sort).

## Verification
- Migration applied live via Supabase MCP, then lint-migrations.
- notify.test.ts: state-writer mapping (ok->scheduled+timestamp,
  all-fail->state unchanged).
- Standard gate: server tsc, server tests, client tsc + build,
  workers dry-run --env staging.
- Staging smoke on phone width: toggle row on/off, bulk 5, filter Belum
  empties, sort menu orders server-side.
