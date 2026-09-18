# Admin Table Selection — reusable module

Date: 2026-09-18. Status: build.

## Goal

One uniform bulk-select module for all admin tables. Left-most checkbox
column, page-only select-all with tri-state header, row-body click selects
only when armed. Armed-gated everywhere (no per-table modes).

## Non-goals

- No cross-page "select all N matching" banner (page scope only, v1).
- No new deps. No TanStack adoption (custom shell stays).
- No virtualized tables. No per-row action menus.

## State machine (`hooks/useRowSelection.ts`)

- Store: `Record<RowId, true>` keyed by stable id (`public_id`), never index.
  Presence = selected; deselect deletes the key (never `false`).
- Mode is derived, not stored: `count === 0 ? 'idle' : 'armed'`.
- Anchor ref for shift-range. Set on every plain toggle; cleared on `clear()`.
- `toggle(id, { range, pageIds })`: shift+range selects contiguous slice of
  the current page id list between anchor and id. Anchor missing or outside
  page → plain toggle + re-anchor.
- `toggleAll(pageIds)`: header `all` → remove page ids (may auto-disarm);
  else add all + arm.
- `headerState(pageIds)`: `'none' | 'some' | 'all'` (page scope only).
- `clear()`: caller invokes on any view change (filter/q/sort/limit/page) —
  same contract as `useAdminTableParams` page resets. Selection otherwise
  persists across pages; header always reflects the current page.

## Shell support (`DataTable.tsx`, minimal diff)

- New optional prop `selectHeader?: ReactNode`: prepends `<th class="w-10">`.
- `withMobileLabels` skips stamping when the column label is empty, so the
  checkbox cell falls into the existing `td:not([data-label])` mobile rule
  (plain block, no empty label slot). No CSS change needed.

## Components (`components/admin/RowSelection.tsx`, `AdminBulkBar.tsx`)

- `SelectableRow({ id, selection, pageIds, selectLabel, children })`: renders
  `<tr aria-selected>` + leading checkbox `<td>` (native input,
  `checkbox checkbox-sm`, row-specific `aria-label`). Row click toggles only
  when armed; ignores clicks inside `a,input,button,label,summary` (keeps
  links/toggles working). Selected tint centralized here (`bg-[#f5f5f7]`).
- `SelectAllCheckbox({ state, onToggle, label })`: `checked = state==='all'`,
  `indeterminate` set imperatively via ref callback on every render
  (`state==='some'`), `checked=false` while mixed so AT reports "mixed".
- `AdminBulkBar({ count, actions, onClear, busy })`: in-flow bar (current
  Reminders markup), live count in `role="status"` + `aria-atomic`, announced
  value debounced 250ms so shift-range speaks once. `onClear` returns focus
  to the header checkbox (caller passes ref or focuses by id).

## Keyboard / a11y contract

- Native checkboxes: Tab + Space free. Shift+Space on a row checkbox = range
  from anchor. Toolbar: Escape returns focus to grid.
- Header checkbox cycles mixed → all → none. Never navigates/submits.
- `axe-core` clean on checkbox labeling, `aria-checked`, roles.

## Mobile

- Checkbox column stays (tap target), excluded from labeled-card layout.
- Bulk bar stays in-flow (no fixed positioning, no BottomNav overlap).

## Adoption order

1. Hook + shell + components (no consumers).
2. Reminders first (retires ad-hoc `selected` array + hand-rolled bulk bar;
   behavior unchanged: schedule/cancel/clear, 20-id cap stays).
3. History → Orders → Products/Vault later. Tables without bulk actions skip
   the bar; checkbox UX stays available via the same pieces.

## Verify

- Client `tsc --noEmit`, `vite build` green.
- Smoke (Reminders): checkbox arms → row clicks toggle → shift-click ranges →
  header tri-states → page change keeps count, header reflects page → filter
  change clears → bulk bar announces count once.
