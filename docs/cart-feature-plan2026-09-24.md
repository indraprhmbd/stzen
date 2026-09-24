# Cart Feature Plan

## Context

Cart must combine multiple vault variants and quantities into one SumoPod QRIS payment. Manual payment remains fallback. Current flow is single-item: `orders` stores one variant, amount, credential, and delivery state.

Current SumoPod dashboard source reports Rp1.000 minimum, while app code enforces observed Rp10.000 rule. API-side minimum and idempotency contract remain unverified.

## Decisions

| Area | Decision |
|---|---|
| Identity | Server-side guest cart using hashed HttpOnly cookie; merge once after login |
| Storage | PostgreSQL source of truth; no Redis at current scale |
| Lines | One variant per cart line, server-limited quantity |
| Products | Vault variants only, including backorder-enabled variants |
| Payments | Aggregate SumoPod QRIS plus manual fallback |
| Minimum | Keep cart valid below floor; disable QRIS, retain manual payment; no artificial padding |
| Pricing | Recalculate from current database prices at checkout |
| Order shape | One immutable order unit per purchased account |
| Stock | Atomically reserve SumoPod units at checkout |
| Manual orders | Do not hold stock indefinitely; recheck during approval |
| Backorder | Freeze eligibility at checkout; allocate oldest paid unit first |
| Lifecycle | Independent delivery, warranty, and refund per unit |
| Sync | Server responses plus focus refresh; no realtime initially |

Chose PostgreSQL and synchronous checkout over distributed services because current traffic does not justify microservice or saga infrastructure. Chose unit-level lifecycle over parent-only state because partial delivery and refund must remain possible.

## Domain

```text
Cart: mutable purchase intent
Cart Line: one variant with quantity
Order: one customer purchase and one aggregate payment
Order Unit: one purchased account
Reservation: credential held for one order unit
```

Status axes:

```text
Order payment: PENDING | PAID | FAILED | EXPIRED | REJECTED
Order fulfillment: NOT_STARTED | PARTIAL | COMPLETE
Order unit: PENDING_PAYMENT | RESERVED | AWAITING_STOCK |
             AWAITING_CREDENTIAL | DELIVERED | REFUNDED | REVOKED
```

Customer-facing order state derives from both axes, including `PARTIALLY_DELIVERED` and `PARTIALLY_REFUNDED`.

## Implementation

### Data model

```text
carts
- id, user_id?, guest_token_hash?, status, version, expires_at

cart_items
- id, cart_id, variant_id, quantity, unit_price_snapshot
- unique(cart_id, variant_id)

orders
- existing identity and ownership fields
- payment_status, fulfillment_status
- subtotal, payment_fee, payment_total
- checkout_attempt_id, terms_consented_at, paid_at, refunded_amount

order_units
- id, order_id, variant_id?, vault_item_id?, position
- frozen product, variant, price, cost, duration, delivery, backorder snapshots
- status, delivered_at, refunded_amount
- one row per purchased unit

order_unit_delivery_info
- order_unit_id, customer_account, wa_number

payment_attempts
- id, order_id, provider, idempotency_key, request_fingerprint
- provider_payment_id, provider_order_ref, checkout_url
- requested_amount, expected_webhook_amount, status, expires_at

webhook_events
- provider, provider_event_id, payload_hash
- processing_status, attempts, order_id?, last_error

vault_items reservation additions
- reserved_order_unit_id, reserved_at, reservation_expires_at
```

Cart and order-unit tables remain Hono-only. Enable RLS, revoke client grants, and use Worker service role.

### Historical orders

Use expand-and-contract migration:

1. Add tables and nullable fields.
2. Backfill one order unit for each legacy order.
3. Derive new payment and fulfillment axes from legacy status.
4. Deploy unit-aware code while retaining legacy fields for rollback.
5. Remove deprecated fields only after rollout.

### Checkout transaction

Use one service-role-only Postgres RPC. `supabase-js` cannot group arbitrary queries into one transaction.

`checkout_cart` transaction:

1. Lock active cart with `FOR UPDATE`.
2. Verify user, cart version, idempotency key, and request fingerprint.
3. Lock and re-read cart variants.
4. Verify active vault variants and current parent status.
5. Recalculate subtotal from database prices.
6. Validate terms, contacts, payment method, and SumoPod minimum.
7. Create order and one unit per quantity.
8. Freeze variant, price, cost, duration, backorder, and contact data.
9. Reserve `AVAILABLE` credentials with `FOR UPDATE SKIP LOCKED`.
10. Permit `AWAITING_STOCK` only for frozen backorder units.
11. Roll back all changes if any non-backorder unit lacks stock.
12. Mark cart `CHECKOUT_PENDING` and persist checkout result.

Cart writes use desired quantity, not `quantity + 1`. Example:

```text
PUT /api/v1/cart/items/:variantId
{ "quantity": 3, "expectedVersion": 12 }
```

### Payment and webhook

SumoPod idempotency is undocumented, so application owns one active payment attempt per checkout:

- Persist attempt and request fingerprint before provider call.
- Store provider payment ID and checkout URL immediately.
- Return stored URL for true retries.
- Do not create another payment after uncertain timeout.
- Compare webhook against frozen payment amount.

Webhook sequence:

1. Verify signature or token.
2. Persist event using unique provider event ID.
3. Lock event and order.
4. Verify provider reference and frozen amount.
5. Transition payment once.
6. Convert reservations once.
7. Fulfill units idempotently.
8. Mark event processed and return 2xx.

Replace current claim-before-validation behavior at `server/modules/payments/payments.service.ts:84`; failed processing must remain retryable.

### Fulfillment

```text
SumoPod paid
  -> RESERVED credentials become SOLD
  -> reserved units become DELIVERED
  -> order fulfillment becomes COMPLETE or PARTIAL
  -> cart becomes CONVERTED

SumoPod failed or expired
  -> release all reservations
  -> restore cart to ACTIVE

Restock
  -> allocate to oldest paid backorder unit
  -> order by order creation, then unit position

Manual approval
  -> recheck stock
  -> allocate pool credential or encrypted manual credential
```

Credentials become visible only for individually delivered units. Warranty and refund target one unit.

### Guest merge

- Cart cookie: cryptographically random, HttpOnly, Secure outside local HTTP, SameSite, fixed path.
- Store only token hash.
- Lock guest and user carts during merge.
- Sum matching variant quantities and enforce limits.
- Mark guest cart converted and rotate token.
- Never copy user cart into guest cart on logout.
- Use `dev.stzen.web.id` with `api-dev.stzen.web.id`; cross-site Pages and Workers domains can block guest cookies.

### API

```text
GET    /api/v1/cart
PUT    /api/v1/cart/items/:variantId
DELETE /api/v1/cart/items/:variantId
DELETE /api/v1/cart
POST   /api/v1/cart/merge
POST   /api/v1/checkout
```

Required error codes:

```text
CART_CHANGED
ITEM_UNAVAILABLE
PRICE_CHANGED
STOCK_UNAVAILABLE
CHECKOUT_IN_PROGRESS
PAYMENT_MINIMUM_NOT_MET
TERMS_REQUIRED
DELIVERY_INFO_REQUIRED
IDEMPOTENCY_CONFLICT
```

Cart, checkout, order, and account responses use `Cache-Control: private, no-store`.

### Client

Use separate React state and dispatch contexts with `useReducer`:

- Server response replaces optimistic state.
- Mutation generation prevents stale response overwrite.
- Refetch on auth change, focus, and visibility return.
- Reset state on logout or user switch.
- Add quantity and cart action to product detail.
- Add header cart badge and `/cart` page.
- Move checkout dialog out of `client/src/pages/ProductDetail.tsx`.
- Show current totals, price changes, stock issues, backorder state, and QRIS eligibility.
- Dashboard and admin show per-unit credentials, delivery, warranty, and refund progress.

### Required tests

- Guest merge concurrency and isolation.
- Cart ownership and version conflicts.
- Server price and total enforcement.
- Quantity expansion into exact unit count.
- Concurrent reservations never oversell.
- Full rollback on partial stock failure.
- Duplicate checkout, payment, and webhook requests produce one economic result.
- Failed and expired payments release reservations.
- Backorder FIFO across units.
- Partial delivery and unit-level refunds.
- Credential access rejects undelivered units.
- Legacy orders remain manageable.

## Delivery

1. **SumoPod contract spike:** probe Rp1.000, Rp9.999, Rp10.000, duplicate order ID, expiration, status lookup, late webhook, and charged amount.
2. **Order-unit foundation:** additive schema, legacy backfill, reservation fields, durable payment and webhook records.
3. **Atomic checkout:** cart conversion RPC, idempotency, aggregate payment, reservation lifecycle, unit FIFO.
4. **Cart backend:** guest cookie, authenticated cart, merge, route errors, rate limits, private caching.
5. **Storefront cart:** provider, cart page, quantity, checkout, header badge, order-unit dashboard.
6. **Admin lifecycle:** selected-unit delivery, manual credential, unit warranty and refund, aggregate statuses.
7. **Cleanup:** remove direct checkout and deprecated single-item fields after verified rollout.

## Acceptance Criteria

- Guest cart merges exactly once after login.
- Multiple vault variants and quantities create one aggregate QRIS order.
- Every purchased account is independently fulfilled and accounted for.
- Browser cannot alter price, subtotal, fee, or payment amount.
- Concurrent checkout cannot oversell credentials.
- Retries cannot duplicate orders, payments, reservations, or fulfillment.
- Failed payment releases stock and restores cart.
- Backorders fulfill FIFO.
- Only delivered units expose credentials.
- Below-floor cart uses manual payment, not padding.
- Legacy orders remain valid.
- Direct client access to cart and order-unit data stays blocked.

## Open Questions

- Exact SumoPod API minimum and below-minimum error contract.
- SumoPod duplicate `order_id` behavior.
- SumoPod status lookup, cancellation, and expiration behavior.
- Late completed webhook behavior.
- Exact charged amount and fee treatment.
- Maximum quantity and cart limits.
- Reservation expiry after provider expiration is confirmed.
- Partial-refund treatment of QRIS fees.
- Whether staging receives `api-dev.stzen.web.id`.

## Sources

- https://sumopod.com/dashboard/managed-payment
- https://sumopod.com/assets/Wallet-Mbb_N71H.js
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/checkout/fulfillment
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://react.dev/learn/scaling-up-with-reducer-and-context
- https://hono.dev/docs/guides/helpers
