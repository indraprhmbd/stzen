import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { ordersService } from '../orders/orders.service'

// ─── Admin Order Routes ─────────────────────────────────────────────────────

type AdminOrderEnv = AuthEnv

export const adminOrderRoutes = new Hono<AdminOrderEnv>()

adminOrderRoutes.use('*', authMiddleware)
adminOrderRoutes.use('*', requireRole('admin'))

// GET / — List all orders with optional status filter
adminOrderRoutes.get('/', async (c) => {
  const status = c.req.query('status')
  const allOrders = await ordersService.listAll(status)
  return c.json(allOrders)
})

// POST /:id/approve — Approve payment: PENDING -> PAID
adminOrderRoutes.post('/:id/approve', async (c) => {
  const order = await ordersService.transitionStatus(c.req.param('id'), 'approve')
  return c.json(order)
})

// POST /:id/reject — Reject payment: PENDING -> REJECTED
adminOrderRoutes.post('/:id/reject', async (c) => {
  const order = await ordersService.transitionStatus(c.req.param('id'), 'reject')
  return c.json(order)
})

// POST /:id/deliver — Mark delivered: PAID -> DELIVERED
adminOrderRoutes.post('/:id/deliver', async (c) => {
  const order = await ordersService.transitionStatus(c.req.param('id'), 'deliver')
  return c.json(order)
})
