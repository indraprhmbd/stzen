import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { type AuthEnv } from '../../shared/middleware/auth'
import { CheckoutSchema } from './checkout.schema'
import { checkoutService } from './checkout.service'
import { appendAudit, findAuditByIdempotencyKey } from '../../shared/lib/audit'

// ─── Checkout Routes ────────────────────────────────────────────────────────

type CheckoutEnv = AuthEnv

export const checkoutRoutes = new Hono<CheckoutEnv>()
  // Auth is enforced globally in app.ts.

  // POST / — Create order
  .post(
  '/',
  zValidator('json', CheckoutSchema),
  async (c) => {
    const user = c.get('user')
    const { productId } = c.req.valid('json')
    // Double-click / retry with the same key returns the original order
    // instead of minting a duplicate PENDING row.
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior, 201)
    }
    const order = await checkoutService.createOrder(user.sub, productId)
    await appendAudit({
      action: 'order:create',
      resourceType: 'order',
      resourcePublicId: (order as any).orderId ?? (order as any).id,
      resourceName: (order as any).productName ?? '',
      snapshotText: `Order ${(order as any).orderId ?? (order as any).id} PENDING dibuat oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      diff: order,
      idempotencyKey,
    }).catch((e) => console.error('[audit] order:create failed', e))
    return c.json(order, 201)
  }
)
