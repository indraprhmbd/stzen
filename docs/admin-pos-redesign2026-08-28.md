# Admin POS Redesign — Standardized Store Dashboard

**Date:** 2026-08-28
**Scope:** 6-7 files new/reworked, 1 server endpoint, 1 header edit
**Status:** Planned — awaiting build

## Problem

Admin currently uses storefront `Layout` (Header+Footer, brutalist Zen tokens, subtitles, decorative borders). No sidebar, no density. Two flat pages `/admin` (products+stock combined grid) and `/admin/orders` (card list). Admin link leaks into client navbar though gated by role. Not a POS — pretty, not scannable.

## Decisions (user-locked)

- 4 pages: Overview / Products / Orders (+ inline Stock for now, extractable later)
- Tables everywhere, dense, minimal whitespace, no pretty styling — separate from client Zen lime/pink brutalism
- Admin copy Indonesian only (frontend), codebase keys English ISO
- Mobile: DaisyUI drawer sidebar
- New stats endpoint simple aggregates
- Categories: dynamic (derived from existing products distinct values). Single `category: string` per product for now. Multi-category (1 product → N categories, likely `product_categories` M2M) deferred — schema stays `products.category` text.
- No subtitles/gibberish — h1 + utilities + table only

## Changes

### 1. Header — remove admin from navbar
- `client/src/components/Header.tsx:16-20` delete `isAdmin` navLinks spread and ADMIN badge
- Admin accessed via direct `/admin` URL. `RequireAuth` + `RequireAdmin` guards stay (redirect non-admin → `/dashboard`)

### 2. Shell

```
client/src/layouts/AdminLayout.tsx    # drawer + sidebar + topbar + <Outlet>
client/src/layouts/AdminSidebar.tsx   # menu: Ringkasan, Produk, Pesanan
```

- Desktop: fixed `w-60 bg-neutral text-neutral-content`, `menu` vertical. Mobile: DaisyUI `drawer` with hamburger.
- Topbar: `h-14 bg-white border-b`, user email + KELUAR.
- `client/src/App.tsx` — nest `/admin` under `AdminLayout` with `RequireAuth+RequireAdmin` on parent, `lazy()` per child:
  ```
  /admin          → Overview (index)
  /admin/products → Products (table + drawer form + inline stock)
  /admin/orders   → Orders (table + actions)
  ```

### 3. Overview — `client/src/pages/admin/Overview.tsx`

- 4 stat cards: Total Produk | Total Stok | Pesanan Pending | Pendapatan (sum PAID+DELIVERED)
- Tables: Pesanan Terbaru (5 rows) + Stok Menipis (<5)
- Data: `GET /api/v1/admin/stats`

### 4. Products — `client/src/pages/admin/Products.tsx`

- Table columns: Nama | Kategori | Harga | Stok | Status | Aksi (Edit/Hapus)
- Utilities: Cari (filter `name` client-side) + Filter Kategori (dynamic distinct list from `GET /admin/products`) + TAMBAH PRODUK (opens drawer-end form)
- Drawer form: `name, category (free text + datalist from existing), price, badge, description, instructions, isActive` — wiring `POST /admin/products`, `PUT /admin/products/:id`, `DELETE /admin/products/:id`
- Inline Stock block below table: Pilih Produk select + textarea `email:pass` per line + IMPOR KE VAULT → `POST /admin/products/:id/stock` (existing `vaultService.importCredentials`). Extract to `/admin/stock` later by moving this block.

### 5. Orders — `client/src/pages/admin/Orders.tsx`

- Table columns: ID (8 mono) | Tanggal | Produk | Pelanggan (8char) | Jumlah | Status | Aksi
- Utilities: Cari (produk/pelanggan) + Filter Status select with counts
- Actions: SETUJUI/TOLAK when PENDING, KIRIM when PAID → `POST /admin/orders/:id/{approve,reject,deliver}`

### 6. Server — stats endpoint

```
server/modules/admin/admin.stats.routes.ts
  GET /api/v1/admin/stats
    - count products
    - count vault_items where status='AVAILABLE' (total stock)
    - count orders where status='PENDING'
    - sum orders.amount where status IN ('PAID','DELIVERED')
  Auth: authMiddleware + requireRole('admin')
  Mount: adminRoutes.route('/stats', adminStatsRoutes)
```

### 7. i18n

- Extend `client/src/config/copy.ts` with `admin: { sidebar, overview, products, orders }` — keys EN, values ID. Admin pages use `t.admin.*` (id). Codebase stays EN.

### 8. Execution Order

1. Header remove link
2. Stats endpoint + mount
3. AdminLayout + Sidebar + copy admin strings
4. App.tsx nested routes
5. Overview → Products → Orders (build verify each)
6. Delete legacy `pages/Admin.tsx`, `pages/AdminOrders.tsx`
7. `npx vite build` verify chunks (expect admin chunks separate)

## Deferred

- Multi-category (product_categories junction table + filter chips) — schema change, defer until category UX validated with single string.
- Server pagination/search for products/orders — client-side filter first, add `?q=&category=&page=` later if >100 rows.
- Order detail drawer + credential preview in admin — not needed for POS queue.

## Result (before/after)

| Before | After |
|---|---|
| Store Layout + Header/Footer + brutalist + subtitles | AdminLayout sidebar + topbar, neutral, dense, no subtitles |
| Flat /admin + /admin/orders cards | Nested /admin/* tables with utilities |
| Stock mixed in grid card | Inline stock block under Products table |
| No stats | Simple stats endpoint + Overview cards |
| Categories free text no filter | Dynamic category filter from distinct values |

