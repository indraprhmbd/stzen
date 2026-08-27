import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../../shared/middleware/auth'
import { ordersService } from './orders.service'
import { credentialsRoutes } from './credentials.routes'

// ─── Order Routes (User) ────────────────────────────────────────────────────

type OrderEnv = AuthEnv

export const orderRoutes = new Hono<OrderEnv>()

orderRoutes.use('*', authMiddleware)

// GET / — List current user's orders
orderRoutes.get('/', async (c) => {
  const user = c.get('user')
  const userOrders = await ordersService.listByUser(user.sub)
  return c.json(userOrders)
})

// GET /:id — Order detail (must belong to current user)
orderRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const order = await ordersService.getById(c.req.param('id'), user.sub)
  return c.json(order)
})

// GET /:id/credentials — Decrypt vault item for this order
orderRoutes.route('/:id/credentials', credentialsRoutes)
