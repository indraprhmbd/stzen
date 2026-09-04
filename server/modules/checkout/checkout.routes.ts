import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { type AuthEnv } from '../../shared/middleware/auth'
import { CheckoutSchema } from './checkout.schema'
import { checkoutService } from './checkout.service'
import { appendAudit } from '../../shared/lib/audit'

// ─── Checkout Routes ────────────────────────────────────────────────────────

type CheckoutEnv = AuthEnv

export const checkoutRoutes = new Hono<CheckoutEnv>()

// Auth is enforced globally in app.ts.

// POST / — Create order
checkoutRoutes.post(
  '/',
  zValidator('json', CheckoutSchema),
  async (c) => {
    const user = c.get('user')
    const { productId } = c.req.valid('json')
    const order = await checkoutService.createOrder(user.sub, productId)
    await appendAudit({
      action: 'order:create',
      resourceType: 'order',
      resourcePublicId: (order as any).orderId ?? (order as any).id,
      resourceName: (order as any).productName ?? '',
      snapshotText: `Order ${(order as any).orderId ?? (order as any).id} PENDING dibuat oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
    }).catch(() => {})
    return c.json(order, 201)
  }
)
