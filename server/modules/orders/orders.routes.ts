import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { type AuthEnv } from '../../shared/middleware/auth'
import { ordersService } from './orders.service'
import { credentialsRoutes } from './credentials.routes'

// ─── Order Routes (User) ────────────────────────────────────────────────────

type OrderEnv = AuthEnv

export const orderRoutes = new Hono<OrderEnv>()
  // Auth is enforced globally in app.ts.

  // GET / - List current user's orders, newest first, paginated.
  // Dashboard loads 8 at a time and appends via "load more".
  .get('/',
    zValidator(
      'query',
      z.object({
        status: z.enum(['PENDING', 'PAID', 'DELIVERED', 'REJECTED', 'REFUNDED']).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(8),
        offset: z.coerce.number().int().min(0).default(0),
      })
    ),
    async (c) => {
      const user = c.get('user')
      const { status, limit, offset } = c.req.valid('query')
      const result = await ordersService.listByUser(user.sub, { status, limit, offset })
      return c.json(result)
    }
  )

// GET /:id - Order detail (must belong to current user)
  .get('/:id', async (c) => {
  const user = c.get('user')
  const order = await ordersService.getById(c.req.param('id'), user.sub)
  return c.json(order)
})

// DELETE /:id - Buyer cancels own dead PENDING order (see deleteOwnOrder)
  .delete('/:id', async (c) => {
  const user = c.get('user')
  const result = await ordersService.deleteOwnOrder(c.req.param('id'), user.sub)
  return c.json(result)
})

// GET /:id/credentials - Decrypt vault item for this order
  .route('/:id/credentials', credentialsRoutes)
