import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { productVariants, products } from '../../shared/db/schema'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { generatePublicId } from '../../shared/lib/publicId'
import { generateSku, composeVariantName } from '../../shared/lib/sku'
import { BulkStockSchema } from '../products/products.schema'
import { vaultService } from '../vault/vault.service'
import { appendAudit } from '../../shared/lib/audit'

const VariantCreateSchema = z.object({
  productId: z.string().min(1),
  price: z.string().regex(/^\d+$/, 'Price integer'),
  compareAtPrice: z.string().regex(/^\d+$/, 'Compare price integer').nullable().optional(),
  badge: z.string().nullable().optional(),
  overview: z.string().max(200).nullable().optional(),
  description: z.string().nullable().optional(),
  durationMonths: z.number().int().nullable().optional(),
  durationUnit: z.enum(['day', 'week', 'month']).optional().default('month'),
  accountType: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
  fulfillmentType: z.enum(['vault', 'on_demand']).optional().default('vault'),
  isActive: z.boolean().optional(),
})

const VariantUpdateSchema = z.object({
  productId: z.string().optional(),
  price: z.string().regex(/^\d+$/, 'Price integer').optional(),
  compareAtPrice: z.string().regex(/^\d+$/, 'Compare price integer').nullable().optional(),
  badge: z.string().nullable().optional(),
  overview: z.string().max(200).nullable().optional(),
  description: z.string().nullable().optional(),
  durationMonths: z.number().int().nullable().optional(),
  durationUnit: z.enum(['day', 'week', 'month']).optional(),
  accountType: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
  fulfillmentType: z.enum(['vault', 'on_demand']).optional(),
  isActive: z.boolean().optional(),
})

type VariantEnv = AuthEnv
export const adminVariantRoutes = new Hono<VariantEnv>()
  // Auth is enforced globally in app.ts; this only adds the role check.
  .use('*', requireRole('admin'))

  // GET / — list variants with stock
  .get('/', async (c) => {
  const { sql, eq } = await import('drizzle-orm')
  const { vaultItems, products } = await import('../../shared/db/schema')
  const rows = await db
    .select({
      id: productVariants.publicId,
      publicId: productVariants.publicId,
      internalId: productVariants.id,
      productId: products.publicId,
      internalProductId: productVariants.productId,
      sku: productVariants.sku,
      name: productVariants.name,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      badge: productVariants.badge,
      durationMonths: productVariants.durationMonths,
      durationUnit: productVariants.durationUnit,
      accountType: productVariants.accountType,
      conditions: productVariants.conditions,
      fulfillmentType: productVariants.fulfillmentType,
      isActive: productVariants.isActive,
      baseName: products.name,
      category: products.category,
      createdAt: productVariants.createdAt,
    })
    .from(productVariants)
    .leftJoin(products, eq(productVariants.productId, products.id))
    .orderBy(productVariants.createdAt)
  const counts = await db.select({ variantId: vaultItems.variantId, count: sql<number>`cast(count(*) as int)` }).from(vaultItems).where(eq(vaultItems.status, 'AVAILABLE')).groupBy(vaultItems.variantId)
  const map = new Map(counts.map((x) => [x.variantId, x.count]))
  const withStock = rows.map((r: any) => ({ ...r, stockCount: r.fulfillmentType === 'on_demand' ? 9999 : map.get(r.internalId) ?? 0 }))
  return c.json(withStock)
})

// GET /:id/detail — single variant with overview/description for edit form.
// List query omits these fields to reduce payload; edit fetches on demand.
  .get('/:id/detail', async (c) => {
  const { sql } = await import('drizzle-orm')
  const { vaultItems, products } = await import('../../shared/db/schema')
  const publicId = c.req.param('id')
  const [row] = await db
    .select({
      id: productVariants.publicId,
      overview: productVariants.overview,
      description: productVariants.description,
    })
    .from(productVariants)
    .where(eq(productVariants.publicId, publicId))
  if (!row) return c.json({ error: 'Variant not found' }, 404)
  return c.json(row)
})

// POST / — create variant, composite name + auto sku
  .post('/', zValidator('json', VariantCreateSchema), async (c) => {
  const data = c.req.valid('json') as any
  const [base] = await db.select({ name: products.name }).from(products).where(eq(products.publicId, data.productId))
  // allow productId as publicId or internal
  let baseName = base?.name ?? 'Product'
  let baseId: string | null = null
  const [p] = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.publicId, data.productId))
  if (p) { baseName = p.name; baseId = p.id }
  else {
    const [p2] = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, data.productId))
    if (p2) { baseName = p2.name; baseId = p2.id }
  }
  const name = composeVariantName(baseName, data.durationMonths, data.durationUnit, data.accountType, data.conditions)
  const sku = generateSku(baseName, data.durationMonths, data.durationUnit, data.accountType)
  const publicId = generatePublicId()
  const priceInt = parseInt(data.price, 10)
  let compareAt: number | null = null
  if (data.compareAtPrice) {
    const v = parseInt(data.compareAtPrice, 10)
    if (v > priceInt) compareAt = v
  }
  const [created] = await db.insert(productVariants).values({
    publicId,
    productId: baseId,
    sku,
    name,
    price: priceInt,
    compareAtPrice: compareAt,
    badge: data.badge,
    overview: data.overview ?? null,
    description: data.description ?? null,
    durationMonths: data.durationMonths,
    accountType: data.accountType,
    conditions: data.conditions,
    fulfillmentType: data.fulfillmentType ?? 'vault',
    isActive: data.isActive ?? true,
  } as any).returning()
  const { publicId: pid, ...rest } = created as any
  const user = c.get('user')
  await appendAudit({
    action: 'variant:create',
    resourceType: 'variant',
    resourcePublicId: pid,
    resourceName: (created as any).name ?? sku,
    snapshotText: `Varian ${sku} dibuat oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
    actorId: user.sub,
    actorEmail: user.email ?? null,
    actorType: 'admin',
  }).catch((e) => console.error('[audit] admin variant action failed', e))
  return c.json({ ...rest, id: pid, sku, name }, 201)
})

// PUT /:id — update variant
  .put('/:id', zValidator('json', VariantUpdateSchema), async (c) => {
  const publicId = c.req.param('id')
  const data = c.req.valid('json') as any
  if (data.price !== undefined) data.price = parseInt(data.price, 10)
  if (data.compareAtPrice !== undefined) {
    data.compareAtPrice = !data.compareAtPrice ? null : parseInt(data.compareAtPrice, 10)
    if (data.compareAtPrice !== null) {
      let effPrice = data.price
      if (effPrice === undefined) {
        const [cur] = await db.select({ price: productVariants.price }).from(productVariants).where(eq(productVariants.publicId, publicId))
        effPrice = cur?.price
      }
      if (effPrice === undefined || data.compareAtPrice <= effPrice) data.compareAtPrice = null
    }
  }
  // resolve productId publicId → internal uuid
  if (data.productId) {
    const [p] = await db.select({ id: products.id }).from(products).where(eq(products.publicId, data.productId))
    data.productId = p?.id ?? null
  }
  // recompose name if relevant fields changed (including a move to another induk)
  if (data.durationMonths !== undefined || data.durationUnit !== undefined || data.accountType !== undefined || data.conditions !== undefined || data.productId) {
    const [cur] = await db.select().from(productVariants).where(eq(productVariants.publicId, publicId))
    if (cur) {
      const targetBaseId = (data.productId as string | undefined) ?? (cur as any).productId
      const [base] = targetBaseId ? await db.select({ name: products.name }).from(products).where(eq(products.id, targetBaseId)) : [{ name: cur.name }]
      const baseName = base?.name ?? cur.name
      const unit = data.durationUnit ?? (cur as any).durationUnit ?? 'month'
      const newName = composeVariantName(baseName, data.durationMonths ?? (cur as any).durationMonths, unit, data.accountType ?? (cur as any).accountType, data.conditions ?? (cur as any).conditions)
      data.name = newName
      if (data.durationMonths !== undefined || data.durationUnit !== undefined || data.accountType !== undefined || data.productId) {
        data.sku = generateSku(baseName, data.durationMonths ?? (cur as any).durationMonths, unit, data.accountType ?? (cur as any).accountType)
      }
    }
  }
  const [updated] = await db.update(productVariants).set({ ...data, updatedAt: new Date() } as any).where(eq(productVariants.publicId, publicId)).returning()
  if (!updated) return c.json({ error: 'Variant not found' }, 404)
  const { publicId: pid, ...rest } = updated as any
  const user = c.get('user')
  await appendAudit({
    action: 'variant:update',
    resourceType: 'variant',
    resourcePublicId: pid,
    resourceName: (updated as any).name ?? '',
    snapshotText: `Varian ${(updated as any).name} diperbarui oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
    actorId: user.sub,
    actorEmail: user.email ?? null,
    actorType: 'admin',
  }).catch((e) => console.error('[audit] admin variant action failed', e))
  return c.json({ ...rest, id: pid })
})

// DELETE /:id
  .delete('/:id', async (c) => {
  const publicId = c.req.param('id')
  const [deleted] = await db.delete(productVariants).where(eq(productVariants.publicId, publicId)).returning()
  if (!deleted) return c.json({ error: 'Variant not found' }, 404)
  const user = c.get('user')
  await appendAudit({
    action: 'variant:delete',
    resourceType: 'variant',
    resourcePublicId: publicId,
    resourceName: (deleted as any).name ?? '',
    snapshotText: `Varian ${(deleted as any).name} dihapus oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
    actorId: user.sub,
    actorEmail: user.email ?? null,
    actorType: 'admin',
  }).catch((e) => console.error('[audit] admin variant action failed', e))
  return c.json({ success: true })
})

// POST /:id/stock — bulk import for variant (skip on_demand)
  .post('/:id/stock', zValidator('json', BulkStockSchema), async (c) => {
    const publicId = c.req.param('id')
    const { credentials } = c.req.valid('json')
    if (!credentials || !credentials.trim()) return c.json({ error: 'No valid credential lines' }, 400)
  const [variant] = await db.select({ id: productVariants.id, name: productVariants.name, fulfillmentType: productVariants.fulfillmentType }).from(productVariants).where(eq(productVariants.publicId, publicId))
  if (!variant) return c.json({ error: 'Variant not found' }, 404)
  if (variant.fulfillmentType === 'on_demand') return c.json({ error: 'Varian on demand tidak memerlukan impor stok' }, 400)
  const lines = credentials.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
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
    actorType: 'admin',
  }).catch((e) => console.error('[audit] admin variant action failed', e))
  return c.json(result)
})
