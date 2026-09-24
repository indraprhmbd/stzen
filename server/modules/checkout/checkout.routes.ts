import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { type AuthEnv } from '../../shared/middleware/auth'
import { CheckoutSchema } from './checkout.schema'
import { checkoutService } from './checkout.service'
import { appendAudit, claimIdempotencyKey, findAuditByIdempotencyKey } from '../../shared/lib/audit'

// ─── Checkout Routes ────────────────────────────────────────────────────────

type CheckoutEnv = AuthEnv

const CartCheckoutSchema = z
  .object({
    cartId: z.string().uuid(),
    paymentMethod: z.enum(['manual', 'sumopod']),
    customerAccount: z.string().max(120).optional(),
    waNumber: z.string().max(32).optional(),
    termsAcceptedAt: z.string().datetime({ offset: true }).optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict()

export const checkoutRoutes = new Hono<CheckoutEnv>()
  // Auth is enforced globally in app.ts.

  // POST / - Create order
  .post(
  '/',
  zValidator('json', CheckoutSchema),
  async (c) => {
    const user = c.get('user')
    const { productId, paymentMethod, customerAccount, waNumber, termsAcceptedAt } = c.req.valid('json')
    // Double-click / retry with the same key returns the original order
    // instead of minting a duplicate PENDING row. Claim-first: the unique
    // index is the arbiter under concurrent retries. Loser re-reads the
    // winner's stored order; a key reused with nothing stored yet is a
    // conflict, not a second order.
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior, 201)
      const claimed = await claimIdempotencyKey(idempotencyKey).catch(() => null)
      if (claimed === false) {
        const raced = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
        if (raced) return c.json(raced, 201)
        throw new HTTPException(409, { message: 'Duplicate request in progress' })
      }
    }
    const order = await checkoutService.createOrder(user.sub, productId, { paymentMethod, customerAccount, waNumber, termsAcceptedAt })
    await appendAudit({
      action: 'order:create',
      resourceType: 'order',
      resourcePublicId: (order as any).orderId ?? (order as any).id,
      resourceName: (order as any).productName ?? '',
      snapshotText: `Order ${(order as any).orderId ?? (order as any).id} PENDING dibuat oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'user',
      diff: order,
      idempotencyKey,
    }).catch((e) => console.error('[audit] order:create failed', e))
    return c.json(order, 201)
  }
  )
  .post(
  '/cart',
  zValidator('json', CartCheckoutSchema),
  async (c) => {
    const user = c.get('user')
    const { cartId, paymentMethod, customerAccount, waNumber, termsAcceptedAt, expectedVersion } = c.req.valid('json')
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior, 201)
      const claimed = await claimIdempotencyKey(idempotencyKey).catch(() => null)
      if (claimed === false) {
        const raced = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
        if (raced) return c.json(raced, 201)
        throw new HTTPException(409, { message: 'Duplicate request in progress' })
      }
    }
    const order = await checkoutService.createCartOrder(user.sub, cartId, { paymentMethod, customerAccount, waNumber, termsAcceptedAt, expectedVersion })
    await appendAudit({
      action: 'order:create',
      resourceType: 'order',
      resourcePublicId: (order as any).orderPublicId ?? (order as any).orderId,
      resourceName: `cart:${cartId}`,
      snapshotText: `Order ${(order as any).orderPublicId ?? (order as any).orderId} PENDING dibuat oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'user',
      diff: order,
      idempotencyKey,
    }).catch((e) => console.error('[audit] order:create failed', e))
    return c.json(order, 201)
  }
)
