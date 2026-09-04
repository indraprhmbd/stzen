# Draft: Admin Orders Ticket-Queue (2026-09-04)

Locked decisions (user-confirmed): action-queue tabs, deliver-dialog + credential,
block + flag on vault stockout, aging + 30s poll on action queues.

## Tab model — `?status=` in URL (source of truth)

`useSearchParams` from `react-router-dom` v7 (same convention as Products `?tab=`).
URL-shareable, survives refresh. Switching tab clears `q` so badges stay truthful.

| Tab param | Rows | Poll |
|---|---|---|
| `butuh-tindakan` (default) | PENDING + PAID, oldest first | 30s, cleaned up off-tab |
| `terkirim` | DELIVERED | — |
| `ditolak` | REJECTED | — |
| `refund` | REFUNDED | — |
| `semua` | ALL | — |

Badges reuse `counts` already returned by `ordersService.listAll` — no new query.

Row additions: age cell (`2j 4h`, red when >24h), flow chip VAULT / ON-DEMAND,
`STOK HABIS` exception chip when vault row has zero available.

## Flows

### V — vault (auto-deliver path)
PENDING → webhook `paid` → `allocate_credential` RPC → DELIVERED (exists in
`payments.service.fulfillPaidOrder`). Admin fallback on PAID tab: one Kirim click
→ `deliverWithCredential` allocates + delivers. Zero stock → `ConflictError`
`STOK_HABIS`, order stays PAID, exception chip shows; admin refunds or waits restock.

### O — on-demand (manual ingest path)
PENDING → PAID → stop. No auto-advance (locked). Admin Kirim opens dialog with
credential textarea → server encrypt-imports single vault row + allocates +
delivers in ONE transaction (no orphan stock between import and deliver).

## Server changes (additive, 2 files, no migration)

1. `server/modules/orders/orders.service.ts`
   - `listAll`: add per-row `fulfillmentType`, `paymentProvider`, `vaultAvailable`
     (batched count of AVAILABLE items for row's variantId — not N+1).
   - New `deliverWithCredential(publicId, rawCredential?)`: payable details →
     vault branch allocates (null → throw STOK_HABIS) → setVaultItem → deliver;
     on-demand branch requires credential → import single encrypted row →
     allocate → deliver. `transitionStatus` untouched.
2. `server/modules/admin/admin.orders.routes.ts`
   - `POST /:id/deliver` accepts optional zod `{ credential }`, delegates to
     `deliverWithCredential`. Credential-less call still works for allocated orders.
     Audit action stays `order:deliver`.

Stockout is derived per request, never stored — no schema change.

## Client changes (2 files)

1. `client/src/pages/admin/Orders.tsx` — replace `status` useState + `<select>`
   with URL tab bar; queue mapping constant; age/flow/stockout cells; flow-aware
   Kirim (vault direct, on-demand via dialog); 30s interval refetch on
   `butuh-tindakan` only. Search, CSV, manual modal, receipt untouched.
2. `client/src/components/admin/DeliverDialog.tsx` (new, mirrors ConfirmDialog)
   — flow type, stock state, credential textarea (on-demand only), confirm.

## Verification

`tsc` on touched routes, `vite build`, manual walk: vault happy path, vault
stockout block, on-demand atomic deliver, tab URL share/refresh, poll stops off-queue.
