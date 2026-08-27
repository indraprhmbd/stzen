import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { sql, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { products, vaultItems, orders, profiles } from '../db/schema'
import { authMiddleware, type AuthEnv } from '../middleware/auth'
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  BulkStockSchema,
} from '../lib/schemas'
import { desc } from 'drizzle-orm'
import {
  importKeyFromBase64,
  encrypt,
  type EncryptedPayload,
} from '../utils/crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

type AdminEnv = AuthEnv

// ─── Admin Routes ───────────────────────────────────────────────────────────

const adminRoutes = new Hono<AdminEnv>()

// ─── Auth Middleware (all admin routes require admin role) ───────────────────

adminRoutes.use('*', authMiddleware)
adminRoutes.use('*', async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }
  await next()
})

// ─── GET /api/admin/products ────────────────────────────────────────────────
// List all products with live stock counts

adminRoutes.get('/products', async (c) => {
  // Get all products
  const allProducts = await db.select().from(products)

  // Get stock counts per product
  const stockCounts = await db
    .select({
      productId: vaultItems.productId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(vaultItems)
    .where(eq(vaultItems.status, 'AVAILABLE'))
    .groupBy(vaultItems.productId)

  // Merge stock counts into products
  const countMap = new Map(stockCounts.map((sc) => [sc.productId, sc.count]))
  const productsWithStock = allProducts.map((p) => ({
    ...p,
    stockCount: countMap.get(p.id) ?? 0,
  }))

  return c.json(productsWithStock)
})

// ─── POST /api/admin/products ───────────────────────────────────────────────
// Create a new product

adminRoutes.post(
  '/products',
  zValidator('json', ProductCreateSchema),
  async (c) => {
    const data = c.req.valid('json')

    const [created] = await db.insert(products).values(data).returning()

    return c.json(created, 201)
  }
)

// ─── PUT /api/admin/products/:id ────────────────────────────────────────────
// Update an existing product

adminRoutes.put(
  '/products/:id',
  zValidator('json', ProductUpdateSchema),
  async (c) => {
    const id = c.req.param('id')
    const data = c.req.valid('json')

    const [updated] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning()

    if (!updated) {
      return c.json({ error: 'Product not found' }, 404)
    }

    return c.json(updated)
  }
)

// ─── DELETE /api/admin/products/:id ─────────────────────────────────────────
// Delete a product (cascades to vault_items via FK)

adminRoutes.delete('/products/:id', async (c) => {
  const id = c.req.param('id')

  const [deleted] = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning()

  if (!deleted) {
    return c.json({ error: 'Product not found' }, 404)
  }

  return c.json({ success: true })
})

// ─── POST /api/admin/products/:id/stock ─────────────────────────────────────
// Bulk import credentials (one per line, encrypted before insertion)

adminRoutes.post(
  '/products/:id/stock',
  zValidator('json', BulkStockSchema),
  async (c) => {
    const productId = c.req.param('id')
    const { credentials } = c.req.valid('json')

    // Verify product exists
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))

    if (!product) {
      return c.json({ error: 'Product not found' }, 404)
    }

    // Load encryption key
    const aesSecret = process.env.AES_SECRET_KEY
    if (!aesSecret) {
      return c.json({ error: 'AES_SECRET_KEY not configured' }, 500)
    }
    const key = await importKeyFromBase64(aesSecret)

    // Parse credentials (one per line)
    const lines = credentials
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) {
      return c.json({ error: 'No valid credential lines found' }, 400)
    }

    // Encrypt each credential
    const encryptedItems: Array<{
      productId: string
      credentialPayload: string
      status: 'AVAILABLE'
    }> = []

    for (const line of lines) {
      const payload: EncryptedPayload = await encrypt(key, line)
      encryptedItems.push({
        productId,
        credentialPayload: JSON.stringify(payload),
        status: 'AVAILABLE',
      })
    }

    // Bulk insert
    const inserted = await db
      .insert(vaultItems)
      .values(encryptedItems)
      .returning()

    return c.json({
      imported: inserted.length,
      productId,
    })
  }
)

// ─── GET /api/admin/orders ───────────────────────────────────────────────────
// List all orders with filters

adminRoutes.get('/orders', async (c) => {
  const status = c.req.query('status')

  const whereClause = status ? eq(orders.status, status as any) : undefined

  const allOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      amount: orders.amount,
      paymentRef: orders.paymentRef,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      userId: orders.userId,
      productId: orders.productId,
      userName: profiles.email,
      productName: products.name,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .innerJoin(profiles, eq(orders.userId, profiles.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))

  return c.json(allOrders)
})

// ─── POST /api/admin/orders/:id/approve ─────────────────────────────────────
// Approve payment: PENDING -> PAID

adminRoutes.post('/orders/:id/approve', async (c) => {
  const orderId = c.req.param('id')

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))

  if (!order) {
    return c.json({ error: 'Order not found' }, 404)
  }

  if (order.status !== 'PENDING') {
    return c.json({ error: 'Order not in PENDING status' }, 400)
  }

  const [updated] = await db
    .update(orders)
    .set({ status: 'PAID', paidAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning()

  return c.json(updated)
})

// ─── POST /api/admin/orders/:id/reject ──────────────────────────────────────
// Reject payment: PENDING -> REJECTED

adminRoutes.post('/orders/:id/reject', async (c) => {
  const orderId = c.req.param('id')

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))

  if (!order) {
    return c.json({ error: 'Order not found' }, 404)
  }

  if (order.status !== 'PENDING') {
    return c.json({ error: 'Order not in PENDING status' }, 400)
  }

  const [updated] = await db
    .update(orders)
    .set({ status: 'REJECTED' })
    .where(eq(orders.id, orderId))
    .returning()

  return c.json(updated)
})

// ─── POST /api/admin/orders/:id/deliver ─────────────────────────────────────
// Mark delivered: PAID -> DELIVERED

adminRoutes.post('/orders/:id/deliver', async (c) => {
  const orderId = c.req.param('id')

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))

  if (!order) {
    return c.json({ error: 'Order not found' }, 404)
  }

  if (order.status !== 'PAID') {
    return c.json({ error: 'Order not in PAID status' }, 400)
  }

  const [updated] = await db
    .update(orders)
    .set({ status: 'DELIVERED' })
    .where(eq(orders.id, orderId))
    .returning()

  return c.json(updated)
})

export default adminRoutes
