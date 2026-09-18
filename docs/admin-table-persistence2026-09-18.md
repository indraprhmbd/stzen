# Admin Table Persistence (2026-09-18)

## Problem
Sort persists in URL (`useTableSort` server mode) but filter tab, search,
and pagination are local state on Reminders/History — lost on refresh,
unshareable. Orders hand-rolls tab+q in URL; Products hand-rolls tab.

## Standard: `useAdminTableParams` (`client/src/hooks/`)
One hook owns the full table-state contract. Adopters: Reminders first,
History second, Orders/Products migrate later (no behavior change).

## State contract
URL (shareable, survives refresh):
- `sort`, `sort_dir` — via existing `useTableSort` server mode, untouched.
  (Its toggle already wipes `page`; the stale `offset` delete is harmless.)
- Filter tab — page-defined key (`state`, `status`, `type`…), validated
  against allowlist, invalid → default. Default value omitted from URL.
- `q` — committed search only. Keystrokes live in local draft, debounce
  300ms, then written with `replace:true` (no history spam per keystroke).
- `page` — 1-based human-readable (NOT offset). Invalid (<1, NaN) → 1,
  key omitted when 1. Page clicks push history (back walks pages).
- `limit` — validated against `PAGE_SIZE_OPTIONS`, else default 10.
  Changes use `replace` + reset page.

Local only (ephemeral, never persisted): row selection, busy flags, toasts.
Selection clears whenever the view changes (filter/q/page/limit/sort).

## Rules
- Any filter/q/sort/limit change resets page (delete the key).
- Back/forward adopts external URL changes, but never clobbers an
  in-flight draft (adopt only when draft === committed).
- `TablePagination` stays dumb: adopters pass `offset=(page-1)*limit` and
  map `onOffsetChange(o => setPage(floor(o/limit)+1))`.
- Sort-toggle behavior unchanged (replace, resets page).

## Out of scope
Persisting selection, scroll restoration, server-driven URL defaults.

## Verify (per adopting page)
tsc + build. Manual: set tab+q+page+sort → fresh tab with copied URL →
identical view. Back button: tab/page steps walk, keystrokes don't.
