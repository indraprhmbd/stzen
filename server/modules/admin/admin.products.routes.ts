import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { products } from '../../shared/db/schema'
import { authMiddleware, type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { productsService } from '../products/products.service'
import { vaultService } from '../vault/vault.service'
import { generatePublicId } from '../../shared/lib/publicId'
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

// GET / — List all products with stock counts (exposes public_id as id)
adminProductRoutes.get('/', async (c) => {
  const allProducts = await productsService.listAll()

  // Get stock counts per product (internal id)
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

  // allProducts already has id = publicId, but we need internal id for stock mapping
  // Fetch internal mapping
  const internalRows = await db.select({ id: products.id, publicId: products.publicId }).from(products)
  const internalMap = new Map(internalRows.map((r) => [r.id, r.publicId]))
  const publicToInternal = new Map(internalRows.map((r) => [r.publicId, r.id]))
  const countByPublic = new Map<string, number>()
  for (const sc of stockCounts) {
    const pub = internalMap.get(sc.productId)
    if (pub) countByPublic.set(pub, sc.count)
  }

  const productsWithStock = allProducts.map((p: any) => ({
    ...p,
    stockCount: countByPublic.get(p.id) ?? 0,
  }))

  return c.json(productsWithStock)
})

// POST / — Create product
adminProductRoutes.post(
  '/',
  zValidator('json', ProductCreateSchema),
  async (c) => {
    const data = c.req.valid('json') as any
    const publicId = generatePublicId()
    const dbData: any = { ...data, publicId }
    if (dbData.price !== undefined) dbData.price = parseInt(dbData.price, 10)
    const [created] = await db.insert(products).values(dbData).returning()
    const { publicId: pid, ...rest } = created as any
    return c.json({ ...rest, id: pid }, 201)
  }
)

// PUT /:id — Update product (id is public_id)
adminProductRoutes.put(
  '/:id',
  zValidator('json', ProductUpdateSchema),
  async (c) => {
    const publicId = c.req.param('id')
    const data = c.req.valid('json') as any
    const dbData: any = { ...data, updatedAt: new Date() }
    if (dbData.price !== undefined) dbData.price = parseInt(dbData.price, 10)
    const [updated] = await db
      .update(products)
      .set(dbData)
      .where(eq(products.publicId, publicId))
      .returning()

    if (!updated) {
      return c.json({ error: 'Product not found' }, 404)
    }
    const { publicId: pid, ...rest } = updated as any
    return c.json({ ...rest, id: pid })
  }
)

// DELETE /:id — Delete product (id is public_id)
adminProductRoutes.delete('/:id', async (c) => {
  const publicId = c.req.param('id')
  const [deleted] = await db
    .delete(products)
    .where(eq(products.publicId, publicId))
    .returning()

  if (!deleted) {
    return c.json({ error: 'Product not found' }, 404)
  }
  return c.json({ success: true })
})

// POST /:id/stock — Bulk import credentials (id is public_id)
adminProductRoutes.post(
  '/:id/stock',
  zValidator('json', BulkStockSchema),
  async (c) => {
    const publicId = c.req.param('id')
    const { credentials } = c.req.valid('json')

    const lines = credentials
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) {
      return c.json({ error: 'No valid credential lines found' }, 400)
    }

    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.publicId, publicId))
    if (!product) return c.json({ error: 'Product not found' }, 404)

    const result = await vaultService.importCredentials(product.id, lines)
    return c.json(result)
  }
)
