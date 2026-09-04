import { Hono } from 'hono'
import { type AuthEnv } from '../../shared/middleware/auth'
import { ordersService } from './orders.service'
import { credentialsRoutes } from './credentials.routes'

// ─── Order Routes (User) ────────────────────────────────────────────────────

type OrderEnv = AuthEnv

export const orderRoutes = new Hono<OrderEnv>()
  // Auth is enforced globally in app.ts.

  // GET / — List current user's orders
  .get('/', async (c) => {
  const user = c.get('user')
  const userOrders = await ordersService.listByUser(user.sub)
  return c.json(userOrders)
})

// GET /:id — Order detail (must belong to current user)
  .get('/:id', async (c) => {
  const user = c.get('user')
  const order = await ordersService.getById(c.req.param('id'), user.sub)
  return c.json(order)
})

// GET /:id/credentials — Decrypt vault item for this order
  .route('/:id/credentials', credentialsRoutes)
