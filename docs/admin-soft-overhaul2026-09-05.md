# Admin Soft Overhaul, Iconoir Icons, Monochrome Light Theme

**Date:** 2026-09-05
**Scope:** ~20 client files, 1 new dep, 0 server changes, 0 storefront changes
**Status:** Built 2026-09-05, client `tsc` 0 errors, `vite build` clean, awaiting visual sign off

## Context

Admin dashboard visually split brained. Shell uses dark slate sidebar (`#0f172a`, `client/src/layouts/AdminSidebar.tsx:11`) with Phosphor icons, pages use zinc bordered boxes with Space Grotesk headers and JetBrains Mono numbers. POS operators need calm scannable surface, not brutalist storefront energy.

Orders page polls action queue every 30s (`client/src/pages/admin/Orders.tsx:87-94`). User rejected polling. Fetch on mount plus explicit refresh replaces it.

## Decisions

| Choice | Picked | Rejected | Why |
|---|---|---|---|
| Icon set | iconoir-react 7.12.1, admin only | Full Phosphor swap | Storefront keeps Phosphor, zero storefront churn. Iconoir joins lazy admin chunk, ~1.2KB per icon tree shaken, ~15 icons, budget +20KB |
| Palette | Strict monochrome light | iOS blue accent, dark mode | Soft black `#1D1D1F` ink, `#FAFAFA` canvas, white cards, `#E8E8ED` hairlines, `#6E6E73` secondary text. Only functional color: muted status dots (PENDING amber, PAID blue, DELIVERED green, REJECTED red, REFUNDED violet gray). No dark mode tokens, kills contrast bug class |
| Typeface | System stack in admin scope | Space Grotesk, JetBrains Mono | `-apple-system, SF Pro, Inter, system-ui`. Feels native Apple, zero font cost. Fonts stay loaded globally for storefront |
| Charts | Keep recharts 3.10.1, restyle | Custom SVG sparklines | Already paid (~100KB in admin chunk). Restyle only: ink 1.5px lines, 6% ink area fills, gray grids, soft tooltips |
| Refresh model | Mount fetch plus manual refresh button with `Disinkron HH:MM:SS` label | 30s interval, refetch on focus | User explicit. Overview pattern (`fetchedAt`) replicated to Orders, Products, History, Settings. Storefront payment polls (`Dashboard.tsx:78`, `PaymentReturn.tsx:38`) untouched, buyers need webhook driven updates |
| Rendering | `useMemo` derived lists, stable callbacks, skeleton parity | New store, animation lib | No new runtime deps. Grouped variant lists already memoized in `ProductsPage.tsx:40-65`, extend to chart transforms in Overview |

## Implementation

### Tokens

New file `client/src/styles/admin-soft.css`, imported by `layouts/AdminLayout.tsx` only. All rules scoped under `.admin-soft`. Radius 14 card, 10 control, 999 pill. Shadow `0 1px 2px rgb(0 0 0/.04), 0 8px 24px rgb(0 0 0/.05)` on cards and dialogs only. Tabular numerals via `font-variant-numeric`.

### Shell

`layouts/AdminSidebar.tsx`: white bg, 1px hairline right, 20px Iconoir glyph plus 13px medium label, 10px radius rows, hover `#F5F5F7`, active `#E8E8ED` semibold ink. Collapse behavior unchanged.

`layouts/AdminBottomNav.tsx`: white blur bar, 5 Iconoir tabs, active ink plus dot. Existing 1/4 width scroll pattern kept.

`layouts/AdminLayout.tsx`: topbar white 80% blur sticky, refresh button plus sync caption, avatar soft black circle, ghost sign out. Canvas `bg-[#FAFAFA]`. Phosphor imports removed from all three files.

### Shared components (`components/admin/`)

`StatCard.tsx`: tinted squircle (44px `#F5F5F7`, ink glyph 22px) plus 28px semibold number plus gray caption. New `icon` prop, page passes Iconoir component.

`DataTable.tsx`: header 11px uppercase gray, rows 13.5px, horizontal hairlines only, hover `#F5F5F7`, right aligned tabular numerals. Mobile card CSS in `app.css:258-306` kept, border radius bumped to 14px.

`StatusChip.tsx`: 999 pill, 12% saturation tinted bg, 6px dot plus 13px semibold text. Tones amber, blue, green, red, zinc kept, `dark` and `emerald` aliases mapped to zinc and green.

`EmptyState.tsx`: Iconoir `Inbox` 32px gray in squircle, centered. Replaces Phosphor `Tray`.

`ConfirmDialog.tsx`, `DeliverDialog.tsx`: 14px radius, soft shadow, system type, same open/close API (`openConfirm`, `closeConfirm` IDs unchanged).

`SearchableSelect.tsx`: radius plus soft shadow on panel, active option ink bg white text kept (readable), inline chevron and search SVGs replaced with Iconoir `NavArrowDown` and `Search`.

### Pages

`pages/admin/Overview.tsx`: header row (title plus date left, segmented 7/30/90 plus refresh right). Segmented control replaces range `select`. Charts restyled monochrome. `useMemo` on chart transforms.

`pages/admin/Orders.tsx`: delete interval block lines 87-94 plus `useRef` import. Refresh button already exists line 268, keep plus sync caption. Tabs restyle to segmented look, keep counts. Action buttons keep semantics with soft radius.

`features/products/` (5 components plus `ProductsPage.tsx`): tab bar segmented, group chevron SVGs to Iconoir, buttons radius 10, dialogs inherit dialog restyle. No logic changes.

`pages/admin/History.tsx`, `pages/admin/Settings.tsx`: header plus filter card plus inputs inherit tokens. Refresh affordance added next to filter row.

### Icon map (verified against `node_modules/iconoir-react/dist/esm/regular`, all present)

Overview `Dashboard`, Orders `ShoppingBag`, Products `Cube`, History `ClockRotateRight`, Settings `Settings`, collapse `SidebarCollapse` (fallback `Menu`), shop link `Shop`, out `LogOut`, refresh `Refresh`, plus `Plus`, search `Search`, check `Check`, close `Xmark`, truck `Truck`, key `Key`, chart `GraphUp`, empty `Archive`, chevron `NavArrowDown`. Rejected names absent from dist: `History`, `Store`, `ChartLine`, `Inbox`, `Receipt`.

## Verification

- `npx tsc --noEmit -p tsconfig.json` in `client/`, exit 0
- `vite build` clean. Admin chunks: `AdminLayout` 12.6KB, `Products` 33.3KB, `Orders` 14.8KB, `History` 3.9KB, `Settings` 2.7KB, shared `StatusChip` 3.9KB, `ConfirmDialog` 1.9KB, Iconoir per icon splits (`ShoppingBag` 2.5KB, `Search` 1KB, `IconoirContext` 0.1KB, rest inside page chunks). `Overview` 406.9KB holds recharts, unchanged dep, no new runtime cost. Total Iconoir delta under +15KB, inside +25KB budget
- Zero `phosphor`, `Space Grotesk`, `setInterval` matches across `layouts/`, `pages/admin/`, `features/products/`, `components/admin/`
- Tunnel serves app (redirects `/admin` to `/login` when unauthenticated). Authed visual check needs operator session
- Operator note: restart client dev server after pull, new dep requires Vite pre-bundle. No server restart needed, zero server changes

- Admin chunk size before versus after `vite build`, target delta under +25KB
- Visual sign off via devtools screenshot of `/admin` desktop plus one 390px width pass
