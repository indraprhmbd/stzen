import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index'
import { orders, products } from '../db/schema'
import { authMiddleware, type AuthEnv } from '../middleware/auth'

// ─── Types ──────────────────────────────────────────────────────────────────

type OrderEnv = AuthEnv

// ─── Order Routes (User) ────────────────────────────────────────────────────

const orderRoutes = new Hono<OrderEnv>()

// ─── Auth required for all order routes ──────────────────────────────────────

orderRoutes.use('*', authMiddleware)

// ─── GET /orders ────────────────────────────────────────────────────────────
// List current user's orders

orderRoutes.get('/', async (c) => {
  const user = c.get('user')

  const userOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      amount: orders.amount,
      paymentRef: orders.paymentRef,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      productName: products.name,
      productCategory: products.category,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.userId, user.sub))
    .orderBy(desc(orders.createdAt))

  return c.json(userOrders)
})

// ─── GET /orders/:id ────────────────────────────────────────────────────────
// Get order detail (must belong to current user)

orderRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const orderId = c.req.param('id')

  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      amount: orders.amount,
      paymentRef: orders.paymentRef,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      productName: products.name,
      productCategory: products.category,
      productDescription: products.description,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.id, orderId))

  if (!order) {
    return c.json({ error: 'Order not found' }, 404)
  }

  if (order.userId !== user.sub) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return c.json(order)
})

export default orderRoutes
