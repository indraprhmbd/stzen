import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { products } from '../../shared/db/schema'
import { authMiddleware, type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { productsService } from '../products/products.service'
import { vaultService } from '../vault/vault.service'
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  BulkStockSchema,
} from '../products/products.schema'

// ─── Admin Product Routes ───────────────────────────────────────────────────

type AdminProductEnv = AuthEnv

export const adminProductRoutes = new Hono<AdminProductEnv>()

adminProductRoutes.use('*', authMiddleware)
adminProductRoutes.use('*', requireRole('admin'))

// GET / — List all products with stock counts
adminProductRoutes.get('/', async (c) => {
  const allProducts = await productsService.listAll()

  // Get stock counts per product
  const { sql } = await import('drizzle-orm')
  const { vaultItems } = await import('../../shared/db/schema')

  const stockCounts = await db
    .select({
      productId: vaultItems.productId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(vaultItems)
    .where(eq(vaultItems.status, 'AVAILABLE'))
    .groupBy(vaultItems.productId)

  const countMap = new Map(stockCounts.map((sc) => [sc.productId, sc.count]))
  const productsWithStock = allProducts.map((p) => ({
    ...p,
    stockCount: countMap.get(p.id) ?? 0,
  }))

  return c.json(productsWithStock)
})

// POST / — Create product
adminProductRoutes.post(
  '/',
  zValidator('json', ProductCreateSchema),
  async (c) => {
    const data = c.req.valid('json')
    const [created] = await db.insert(products).values(data).returning()
    return c.json(created, 201)
  }
)

// PUT /:id — Update product
adminProductRoutes.put(
  '/:id',
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

// DELETE /:id — Delete product
adminProductRoutes.delete('/:id', async (c) => {
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

// POST /:id/stock — Bulk import credentials
adminProductRoutes.post(
  '/:id/stock',
  zValidator('json', BulkStockSchema),
  async (c) => {
    const productId = c.req.param('id')
    const { credentials } = c.req.valid('json')

    const lines = credentials
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) {
      return c.json({ error: 'No valid credential lines found' }, 400)
    }

    const result = await vaultService.importCredentials(productId, lines)
    return c.json(result)
  }
)
