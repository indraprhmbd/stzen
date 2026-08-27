import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware, type AuthEnv } from '../../shared/middleware/auth'
import { CheckoutSchema } from './checkout.schema'
import { checkoutService } from './checkout.service'

// ─── Checkout Routes ────────────────────────────────────────────────────────

type CheckoutEnv = AuthEnv

export const checkoutRoutes = new Hono<CheckoutEnv>()

checkoutRoutes.use('*', authMiddleware)

// POST / — Create order
checkoutRoutes.post(
  '/',
  zValidator('json', CheckoutSchema),
  async (c) => {
    const user = c.get('user')
    const { productId } = c.req.valid('json')
    const order = await checkoutService.createOrder(user.sub, productId)
    return c.json(order, 201)
  }
)
