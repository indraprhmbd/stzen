# Order Unit Dashboards

## Context

Cart checkout persists one parent order plus one `order_units` row per purchased account. Parent stores aggregate SumoPod QRIS payment. Units store frozen variant snapshots, credential links, delivery state, and refund state.

Dashboards still render the parent as one product with one credential. That hides multi-variant quantities, partial delivery, per-account credentials, unit warranty, and unit refunds.

Predecessor: `docs/cart-feature-plan2026-09-24.md` covers cart creation, atomic checkout, aggregate payment, reservations, and guest merge. This plan covers dashboard and admin wiring only.

## Decisions

| Area | Decision |
|---|---|
| Warranty anchor | Warranty attaches to `order_units.id` |
| Variant reporting | Reports aggregate unit claims, deliveries, and refunds by `variant_id` |
| Fee scope | QRIS fee stays parent-only |
| Fee formula | `ceil(subtotal * 0.007) + 300`, stored on parent |
| Partial refund | Returns unit price only, excludes QRIS fee |
| Full refund | QRIS fee refund requires explicit operator override plus audit |
| User UI | New aggregate order card plus per-order units modal |
| Admin UI | Parent-child order row: parent aggregate, variant-batch children, unit actions |
| Compatibility | Legacy one-item orders render as one parent plus one unit |
| Warranty schema | Add nullable `order_unit_id` to `warranty_claims`; preserve legacy order-level claims |
| Eligibility | Unit warranty uses unit `delivered_at` plus unit duration snapshots |
| Data access | Service-role reads only; RLS default-deny; no direct client table access |
| Client state | Server responses plus focus refresh; no realtime initially |
| Money authority | Checkout RPC and services recompute money; client displays only |

Chose unit-level warranty over variant-only warranty because quantity expansion creates independent credentials. Two accounts from one variant can fail, rotate, refund, or expire separately.

Chose variant-batch display over a flat unit list because admin needs fast queue scanning with drill-down. Parent shows payment state. Batch shows variant quantity and completion. Unit exposes credential and lifecycle actions.

Chose parent-only fees over prorated fees because SumoPod charges one aggregate QRIS transaction. Example: Rp10.000 plus Rp20.000 creates a Rp30.000 transaction with one fee of Rp510.

## Implementation

### Data model

Add a nullable unit link to warranty claims:

```text
warranty_claims.order_unit_id uuid nullable
FK warranty_claims.order_unit_id -> order_units.id ON DELETE CASCADE
index warranty_claims_order_unit_idx
```

Existing schema already supports the dashboard model:
- `server/db/schema.ts:261-340`: parent order, aggregate payment fields, legacy single-item fields.
- `server/db/schema.ts:342-379`: `order_units`, position, status, frozen snapshots, refund fields.
- `server/db/schema.ts:381-390`: per-unit delivery contact info.
- `server/db/schema.ts:453-468`: order-level warranty claims.
- `server/db/migrations/0034_checkout_cart_insert_product.sql:142-166`: quantity expansion into units.
- `server/db/migrations/0034_checkout_cart_insert_product.sql:168-196`: SumoPod reservation and backorder handling.
- `server/db/migrations/0034_checkout_cart_insert_product.sql:200-209`: aggregate subtotal, fee, and total.

### User dashboard API

Extend user order reads without breaking existing fields:
- `server/modules/orders/orders.service.ts:137-187`: add payment axes, fee/total, unit counts, minimal unit list.
- `server/modules/orders/orders.routes.ts:17-39`: preserve pagination and status query; add unit aggregates.
- Add full unit detail to order detail response, including owner delivery contacts.
- Add `GET /api/v1/orders/:id/units/:unitId/credentials`.
- Require owner, unit `DELIVERED`, vault `SOLD`, vault not `REVOKED`.
- Decrypt only the selected unit through the existing AES-256-GCM path in `server/modules/orders/credentials.routes.ts:53-72`.
- Retain the legacy order credential route as a one-unit compatibility alias.
- Use `Cache-Control: private, no-store` for cart, checkout, order, and account responses.

Response shape:

```text
order
- id, status, paymentStatus, fulfillmentStatus
- amount, subtotal, paymentFee, paymentTotal
- unitCount, deliveredUnits, refundedTotal
- units[]: unitId, position, variant snapshot, status, delivered/refunded flags

order detail
- full units plus owner delivery contacts
- fee breakdown and payment status
```

### User dashboard UI

Replace the single-product card with an aggregate card plus modal:
- `client/src/components/OrderCard.tsx:61-196`: show first product plus `+N products`, item-count badge, aggregate total, payment and fulfillment chips, partial states.
- Add `client/src/components/OrderUnitsModal.tsx`: list all products grouped by variant, show per-unit status, expose credential action only for delivered units, show refund state.
- `client/src/pages/Dashboard.tsx:66-88`: extend order type and fetch shape; preserve pagination, focus refresh, and PENDING polling.
- `client/src/pages/Dashboard.tsx:358-373`: open the units modal from the aggregate card.
- `client/src/pages/Dashboard.tsx:390-443`: reuse receipt-style credential modal for the selected unit.
- Never embed credential plaintext in list responses.

### Admin dashboard API

Extend admin reads and add selected-unit operations:
- `server/modules/orders/orders.service.ts:460-585`: add parent payment/fulfillment axes, unit counts, variant batches, batched vault availability.
- `server/modules/admin/admin.orders.routes.ts:52-69`: preserve tabs, search, sort, pagination, and CSV shape first.
- Add selected-unit delivery endpoint reusing the credential validation in `server/modules/admin/admin.orders.routes.ts:147-169`.
- Update selected-unit path derived from `server/modules/orders/orders.service.ts:587-664`: pool allocation first, manual credential fallback for backorder.
- Update manual approval derived from `server/modules/orders/orders.service.ts:692-790`: recheck and allocate each unit, leave unavailable units in the correct paid/awaiting state.
- Update restock FIFO derived from `server/modules/orders/orders.service.ts:792-817`: oldest paid order first, then lowest unit position.
- Update credential rotation derived from `server/modules/vault/vault.service.ts:315-469`: allocate replacement first, revoke old credential, repoint selected unit, link warranty claim to that unit.
- Extend `server/modules/orders/warranty.service.ts:42-101`: unit eligibility, unit refund preview, legacy order fallback.
- Add per-unit refund preview and refund endpoints; derive parent refund from the sum of unit refunds.
- Keep `order_notes` order-level; timeline remains order audit plus operator notes.

### Admin dashboard UI

Use parent-child rows within the same order ID:
- `client/src/pages/admin/orders/OrderRow.tsx:29-139`: parent aggregate row plus expandable variant-batch children.
- Parent shows ID, date, customer, aggregate amount, payment/fulfillment status, primary actions.
- Child batch shows variant snapshot, quantity, delivered count, refunded count, awaiting count, stock/backorder state.
- Unit actions expose deliver selected unit, rotate credential, warranty claim, refund unit, timeline.
- Reuse `client/src/pages/admin/orders/dialogs.tsx:1-313` with a unit selector.
- Preserve bulk approve for aggregate PENDING approval only.
- Preserve existing tabs in `client/src/pages/admin/orders/types.ts:53-61`.
- Preserve per-order CSV first; add unit-inclusive export after UI verification.

### Required tests

- Unit aggregation and partial delivery/refund derivation.
- Owner isolation for unit credentials.
- Undelivered or revoked units reject credential access.
- Selected-unit delivery and backorder fallback.
- Unit FIFO restock order.
- Per-unit refund preview and parent refund sum.
- Legacy one-item orders use the compatibility path.
- Server TypeScript build and full test suite pass.

Stack: Hono 4.13.5, React 19.1, Supabase Postgres, Drizzle ORM 0.45.2.

## Open Questions

- Full-order QRIS fee refund policy: always non-refundable or operator override only?
- Warranty duration source when a unit duration snapshot is null?
- Unit export format: parent rows plus child rows or a separate unit CSV?
- Whether staging receives `api-dev.stzen.web.id` for guest cookie testing?
- Exact SumoPod API minimum and below-minimum error contract; retain the operational Rp10.000 floor until sandbox proof changes it.
