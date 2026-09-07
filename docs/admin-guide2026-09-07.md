# Admin Guide Page

## Context

Admin operators are non-technical. Tribal knowledge about tabs, queues, and recovery flows lives in chat history. Requirement: dedicated in-app guide at a new sidebar menu, Indonesian only, thorough, every section linking to the actual page or tab it describes. Constraints: light and cheap (no backend, no deps), hardcoded content acceptable, config style matching `copy.ts` patterns.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Content shape | Typed TS config `client/src/config/admin.docs.ts`, no backend | Bundle bytes only, zero queries, survives offline. Chose config over CMS because content changes with releases, versioned with code |
| Route | `/admin/panduan`, sixth sidebar item, Book icon | User chose new menu over non-menu link. Position last, after Pengaturan. Outline icon per the no-solid decision |
| FAQ included | Yes, 5-6 entries | User chose plus FAQ. Covers stuck orders, empty vault at deliver, wrong refund, announcement delay, expired session 404 |
| FAQ interaction | Native `<details>` accordion | Zero state, zero deps, accessible by default. Chose over custom accordion because behavior is free |
| Section order | Sidebar order: Ringkasan, Produk, Pesanan, Riwayat, Pengaturan, FAQ | Operator reads top to bottom matching the menu they see |
| Styling | `admin-soft` classes only (`ad-card`, `ad-btn`) | Guide lives inside admin shell, inherits it. No storefront brutal classes here |

## Implementation

- `client/src/config/admin.docs.ts`: `AdminDocLink { label, to }`, `AdminDocSection { id, title, intro, points[], links[] }`, `AdminDocFaq { q, a, links[] }`. Deep links use real routes with query strings (`/admin/products?tab=stok`, `/admin/orders?status=semua`).
- `client/src/pages/admin/Guide.tsx`: sticky mini table of contents with in-page anchors, stacked sections, FAQ `<details>` list. Lazy loaded like other admin pages.
- `client/src/App.tsx`: `<Route path="panduan" element={<Guide />}/>` inside `/admin`.
- `client/src/layouts/AdminSidebar.tsx`, `AdminBottomNav.tsx`: Panduan item with Book icon.
- Verification: client `tsc`, click every deep link from the guide, one `feat(client)` commit, no push.

## Open Questions

Guide content drifts when admin UI changes. No automation planned. Mitigation: guide links use the same route strings as the sidebar, a reviewer checks the guide when touching admin nav.
