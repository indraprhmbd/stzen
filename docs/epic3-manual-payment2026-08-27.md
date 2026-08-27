# Epic 3: Storefront Catalog, Manual Payment & Order Management

## Context

The storefront operates on manual bank transfer payments. No automated payment gateway. Stock is limited and fluctuates without precise tracking. Admin toggles product availability manually. Credentials are sent by admin after payment verification, not automatically by the system.

Core constraints:
- Auth required for checkout (order linked to user, dashboard persistence)
- Stock managed via admin toggle (is_active on product), not per-item reservation
- Payment: user uploads transfer screenshot, admin reviews manually
- Credentials delivered by admin outside the system (WhatsApp, manual copy)
- File upload deferred to next epic (Cloudflare R2 presigned URLs)

---

## Decisions

### Stock Management: Toggle, Not Tracking

Chose product-level toggle over per-item reservation because:
- Stock fluctuates without reliable count (manual restocking, shared credentials)
- Admin knows actual availability better than the system
- Eliminates RESERVED/SOLD state machine complexity
- No race condition risk since allocation is manual

Implementation: products.is_active boolean. Admin toggles in Admin panel. Products with is_active = false are hidden from storefront and cannot be checkout.

### Auth Required for Checkout

Chose auth-required over guest checkout because:
- Order history and status tracking require user identity
- Dashboard (Epic 4) needs persistent order list
- ~500 WAU niche store, users are repeat buyers
- Guest checkout adds email collection, token lookup complexity without clear benefit

### No Webhook Route

Original design included payment webhook for automated allocation. Removed because:
- No payment gateway to send webhooks
- Admin manually approves payments
- Approval done via admin panel endpoints, not incoming webhooks

The allocate_credential SQL function remains in the schema for future automated gateway integration. Not used in manual flow.

### Payment Proof Storage: Deferred

Screenshot upload will use Cloudflare R2 (S3-compatible) with presigned URLs. This is a separate epic. For Epic 3, payment proof is not implemented. Order lifecycle handles status tracking without image upload.

### Order State Machine

```
PENDING -> (user uploads proof, future epic) -> AWAITING_VERIFICATION -> (admin approves) -> PAID -> (admin sends credentials) -> DELIVERED
                                                                   -> (admin rejects) -> REJECTED
```

Epic 3 implements: PENDING, PAID, DELIVERED, REJECTED.
AWAITING_VERIFICATION is reserved for when payment proof upload (R2) is implemented.

---

## API Endpoints

### Public (no auth)

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/products | Active products with stock count |

### Authenticated (user)

| Method | Path | Purpose |
|---|---|---|
| POST | /api/v1/checkout | Create order |
| GET | /api/v1/orders | List user orders |
| GET | /api/v1/orders/:id | Order detail |

### Admin (admin role)

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/admin/orders | All orders with filters |
| POST | /api/v1/admin/orders/:id/approve | Mark PAID |
| POST | /api/v1/admin/orders/:id/reject | Mark REJECTED |
| POST | /api/v1/admin/orders/:id/deliver | Mark DELIVERED |

---

## Endpoint Logic

### GET /api/v1/products (public)

Returns active products with available stock count.

```typescript
db.select({
  ...products,
  stockCount: db.$count(vaultItems, and(
    eq(vaultItems.productId, products.id),
    eq(vaultItems.status, 'AVAILABLE')
  )),
})
.from(products)
.where(eq(products.isActive, true))
```

Optional query param: ?category=streaming filters by category.

### POST /api/v1/checkout (auth)

```typescript
// 1. Validate productId (Zod)
// 2. Check product exists, isActive = true
// 3. Check stock > 0 (count AVAILABLE vault_items)
// 4. If stock = 0 -> 409 "Out of stock"
// 5. Create order: { userId, productId, status: 'PENDING', amount: product.price }
// 6. Return { orderId, amount, productName }
```

No stock reservation. Stock is just checked at checkout time. If stock is 0, checkout fails.

### GET /api/v1/orders (auth)

```typescript
db.select({
  ...orders,
  productName: products.name,
  productCategory: products.category,
})
.from(orders)
.innerJoin(products, eq(orders.productId, products.id))
.where(eq(orders.userId, userId))
.orderBy(desc(orders.createdAt))
```

### POST /api/v1/admin/orders/:id/approve (admin)

```typescript
// 1. Find order (must exist, status must be PENDING)
// 2. Update order: status = 'PAID', paid_at = NOW()
// 3. Return success
```

### POST /api/v1/admin/orders/:id/reject (admin)

```typescript
// 1. Find order (must exist, status must be PENDING)
// 2. Update order: status = 'REJECTED'
// 3. Return success
```

### POST /api/v1/admin/orders/:id/deliver (admin)

```typescript
// 1. Find order (must exist, status must be PAID)
// 2. Update order: status = 'DELIVERED'
// 3. Return success
```

---

## Schema Changes

### orders table: add REJECTED to enum

Current: PENDING, PAID, DELIVERED, REFUNDED
Add: REJECTED

### vault_items table: no changes

Status stays: AVAILABLE, SOLD, RESERVED. RESERVED kept in enum for future automated gateway, not used in manual flow.

---

## Files

### Create

| File | Purpose |
|---|---|
| server/routes/products.ts | Public product catalog |
| server/routes/checkout.ts | Order creation |
| server/routes/orders.ts | User order list and detail |
| client/src/pages/Catalog.tsx | Storefront UI |
| docs/epic3-manual-payment2026-08-27.md | This document |

### Modify

| File | Change |
|---|---|
| server/routes/admin.ts | Add order management endpoints (list, approve, reject, deliver) |
| server/routes/v1.ts | Mount products, checkout, orders routes |
| server/lib/schemas.ts | Add CheckoutSchema |
| server/db/schema.ts | Add REJECTED to orderStatusEnum |
| client/src/App.tsx | Add Catalog route as default |

---

## Key Patterns

Product list with stock count (Drizzle correlated subquery):
```typescript
const stockCount = db.$count(
  vaultItems,
  and(eq(vaultItems.productId, products.id), eq(vaultItems.status, 'AVAILABLE'))
)
```

Order status guard in admin handler:
```typescript
const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
if (!order) return c.json({ error: 'Order not found' }, 404)
if (order.status !== 'PENDING') return c.json({ error: 'Order not in PENDING status' }, 400)
```

---

## Open Questions

- Payment proof upload (R2 presigned URLs): deferred to next epic
- Credential reveal in admin: could add decrypt-on-demand button in admin panel to view credential before sending manually
- Stock count displayed to user is reference only, not enforced at checkout beyond checking > 0
- allocate_credential function kept in schema for future automated gateway, not used in manual flow
