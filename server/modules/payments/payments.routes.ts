import { Hono } from 'hono'
import { type AuthEnv } from '../../shared/middleware/auth'
import { paymentsService } from './payments.service'

// ─── Payment Routes (authed) ─────────────────────────────────────
// Auth is enforced globally in app.ts.

type PaymentsEnv = AuthEnv

export const paymentsRoutes = new Hono<PaymentsEnv>()
  // POST /:orderId/initiate - Start a payment for a PENDING order, owned by the caller
  .post('/:orderId/initiate', async (c) => {
  const user = c.get('user')
  const result = await paymentsService.initiatePayment(c.req.param('orderId'), user.sub)
  return c.json(result)
})

// GET /:orderId/status - Poll payment/order status, owned by the caller
  .get('/:orderId/status', async (c) => {
  const user = c.get('user')
  const result = await paymentsService.getStatus(c.req.param('orderId'), user.sub)
  return c.json(result)
})
