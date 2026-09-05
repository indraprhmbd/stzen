import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { products, productVariants } from '../../shared/db/schema'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { productsService } from '../products/products.service'
import { vaultService } from '../vault/vault.service'
import { generatePublicId } from '../../shared/lib/publicId'
import { appendAudit } from '../../shared/lib/audit'
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  BulkStockSchema,
} from '../products/products.schema'

// ─── Admin Product Routes ───────────────────────────────────────────────────

type AdminProductEnv = AuthEnv

export const adminProductRoutes = new Hono<AdminProductEnv>()
  // Auth is enforced globally in app.ts; this only adds the role check.
  .use('*', requireRole('admin'))

  // GET / — List all products with stock counts (exposes public_id as id)
  .get('/', async (c) => {
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

  // allProducts now includes internalId, use it directly for stock mapping
  const internalIdToPublic = new Map(allProducts.map((p: any) => [p.internalId, p.id]))
  const countByPublic = new Map<string, number>()
  for (const sc of stockCounts) {
    if (!sc.productId) continue
    const pub = internalIdToPublic.get(sc.productId)
    if (pub) countByPublic.set(pub, sc.count)
  }

  const productsWithStock = allProducts.map((p: any) => ({
    ...p,
    internalId: undefined,
    stockCount: countByPublic.get(p.id) ?? 0,
  }))

  return c.json(productsWithStock)
})

// POST / — Create product (induk, price optional, defaults 0)
  .post(
  '/',
  zValidator('json', ProductCreateSchema),
  async (c) => {
    const data = c.req.valid('json') as any
    const publicId = generatePublicId()
    const dbData: any = { ...data, publicId }
    if (dbData.price !== undefined && dbData.price !== '') dbData.price = parseInt(dbData.price, 10)
    else dbData.price = 0
    const [created] = await db.insert(products).values(dbData).returning()
    const { publicId: pid, ...rest } = created as any
    const user = c.get('user')
    await appendAudit({
      action: 'product:create',
      resourceType: 'product',
      resourcePublicId: pid,
      resourceName: (created as any).name ?? '',
      snapshotText: `Produk ${(created as any).name} dibuat oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
    }).catch(() => {})
    return c.json({ ...rest, id: pid }, 201)
  }
)

// PUT /:id — Update product (id is public_id)
  .put(
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

    // Cascade isActive to all variants of this product
    if (data.isActive !== undefined) {
      const internalId = (updated as any).id
      await db
        .update(productVariants)
        .set({ isActive: data.isActive })
        .where(eq(productVariants.productId, internalId))
    }

    const { publicId: pid, ...rest } = updated as any
    const user = c.get('user')
    await appendAudit({
      action: 'product:update',
      resourceType: 'product',
      resourcePublicId: pid,
      resourceName: (updated as any).name ?? '',
      snapshotText: `Produk ${(updated as any).name} diperbarui oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
    }).catch(() => {})
    return c.json({ ...rest, id: pid })
  }
)

// DELETE /:id — Delete product (id is public_id). Refuses when variants
// still reference the base (FK would 500) — move or delete variants first.
  .delete('/:id', async (c) => {
  const publicId = c.req.param('id')
  const [base] = await db.select({ id: products.id }).from(products).where(eq(products.publicId, publicId))
  if (!base) return c.json({ error: 'Product not found' }, 404)
  const { sql: drizzleSql } = await import('drizzle-orm')
  const [{ count: variantCount }] = await db
    .select({ count: drizzleSql<number>`cast(count(*) as int)` })
    .from(productVariants)
    .where(eq(productVariants.productId, base.id))
  if (variantCount > 0) {
    return c.json({ error: `Induk masih memiliki ${variantCount} varian. Pindahkan atau hapus varian dulu.` }, 409)
  }
  const [deleted] = await db
    .delete(products)
    .where(eq(products.publicId, publicId))
    .returning()

  if (!deleted) {
    return c.json({ error: 'Product not found' }, 404)
  }
  const user = c.get('user')
  await appendAudit({
    action: 'product:delete',
    resourceType: 'product',
    resourcePublicId: publicId,
    resourceName: (deleted as any).name ?? '',
    snapshotText: `Produk ${(deleted as any).name} dihapus oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
    actorId: user.sub,
    actorEmail: user.email ?? null,
  }).catch(() => {})
  return c.json({ success: true })
})

// POST /:id/stock — Bulk import credentials (id is public_id)
  .post(
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

    // try variant first (new flow), fallback legacy product
    const [variant] = await db.select({ id: productVariants.id, name: productVariants.name }).from(productVariants).where(eq(productVariants.publicId, publicId))
    if (variant) {
      const result = await vaultService.importCredentials(variant.id, lines)
      const user = c.get('user')
      await appendAudit({
        action: 'stock:import',
        resourceType: 'stock',
        resourcePublicId: publicId,
        resourceName: variant.name,
        snapshotText: `Stok ${result.imported} ditambah ke ${variant.name} (${publicId}) oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
        actorId: user.sub,
        actorEmail: user.email ?? null,
      }).catch(() => {})
      return c.json(result)
    }
    const [product] = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.publicId, publicId))
    if (!product) return c.json({ error: 'Product not found' }, 404)
    const result = await vaultService.importCredentials(product.id, lines)
    const user = c.get('user')
    await appendAudit({
      action: 'stock:import',
      resourceType: 'stock',
      resourcePublicId: publicId,
      resourceName: product.name,
      snapshotText: `Stok ${result.imported} ditambah ke ${product.name} (${publicId}) oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
    }).catch(() => {})
    return c.json(result)
  }
)
