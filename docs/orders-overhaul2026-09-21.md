# Orders System Overhaul 2026-09-21

State machine stays. This arc fixes data flow + tames `admin/Orders.tsx` (987 lines).

Phase 2 shipped 2026-09-21 (commit pending): RefBayar persists via
approve-manual (`paymentRef` schema → `updateData.payment_ref` + `refChanged`
audit bit; `submitReview` sends `mPaymentRef`); refund unblocked for
duration-less orders (button gates on status only, null preview renders
"Refund penuh Rp {amount}"; server already null-safe end-to-end).

## Confirmed bugs (Phase 2)

1. **RefBayar dropped on review-approve.** `submitReview` (Orders.tsx:533-544)
   sends amount + contact only; server `approveManual` never writes
   `payment_ref`. Only the create path persists it. Struk renders
   `paymentRef ?? '-'`, so manual struks show `-`.
   Fix: approve-manual schema += `paymentRef` optional → `updateData.payment_ref`;
   client sends `mPaymentRef`. No migration (column exists).
2. **Refund blocked for duration-less orders.** `computeRefund` returns null
   when `duration_snapshot` is null (lifetime products); dialog gates
   `Lanjut ke Refund` on `preview && status` (Orders.tsx:943) → forever
   disabled. Server `POST /:id/refund` already handles null
   (`refund_amount = null`, overview falls back to amount).
   Fix: enable on status ∈ {PAID, DELIVERED}; null preview → "Refund penuh"
   wording, reuse existing confirm + server path. Test: null-preview order
   transitions, overview fallback counts amount.

## Phase 1 — De-tangle (no behavior change)

`pages/admin/Orders.tsx` → page shell + extracted modules:

- `pages/admin/orders/types.ts` — `AdminOrder`, `RefundCalcData`,
  `ManualVariant`, `TABS`, `orderColumns`, `refundTierLabel`, `formatAge`
- `pages/admin/orders/useManualOrder.ts` — all `m*` state, `ensureManualVariants`,
  `openManual/openReview/resetManualForm/submitManual/submitReview` (+ derived
  `mSelected/mCatalogPrice/mFinalPrice/mFiltered`)
- `pages/admin/orders/useRefundCalc.ts` — `calc*`/`claim*` state,
  `loadCalcPreview/openCalculator/submitClaim/applyCalcRefund`
- `pages/admin/orders/useOrderRowActions.ts` — `handleAction/handleDeliver/
  bulkApprove/askDeliver/askReject/confirmReject/askRefund/confirmRefund/
  openReceipt/printReceipt/openTimeline` + pending/loading/msg state
- `pages/admin/orders/OrderRow.tsx` — row JSX (preps Phase 3 cell merge)
- `pages/admin/orders/dialogs.tsx` — receipt, manual, refund-calc, timeline
  dialogs + reject/refund confirms + DeliverDialog wiring
- Page keeps: tabs/search/sort/selection/query/export-CSV shell, composes hooks.

Verify per extract: client tsc 0. Final: build + budget. One commit.

## Phase 3 — Ticket/notes + badges + row density (separate arc)

- `order_notes` table (order_id FK, note, actor, created_at; RLS on zero-policy)
  + `order:note` audit; surfaced in Riwayat + count chip on row. Additive only.
- Derived badges under status: `klaim N×`, `stok habis`, `overdue`, `refund Rp X`.
- Row merge: TANGGAL+UMUR → one cell; ALUR → product sub-line; REF → ID sub-line.
  9 cols → 7 (incl. select + AKSI).
