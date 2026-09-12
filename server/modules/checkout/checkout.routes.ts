import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { type AuthEnv } from '../../shared/middleware/auth'
import { CheckoutSchema } from './checkout.schema'
import { checkoutService } from './checkout.service'
import { appendAudit, claimIdempotencyKey, findAuditByIdempotencyKey } from '../../shared/lib/audit'

// ─── Checkout Routes ────────────────────────────────────────────────────────

type CheckoutEnv = AuthEnv

export const checkoutRoutes = new Hono<CheckoutEnv>()
  // Auth is enforced globally in app.ts.

  // POST / - Create order
  .post(
  '/',
  zValidator('json', CheckoutSchema),
  async (c) => {
    const user = c.get('user')
    const { productId } = c.req.valid('json')
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
    const order = await checkoutService.createOrder(user.sub, productId)
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
