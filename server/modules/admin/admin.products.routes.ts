import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { productsService, basisBulkService } from '../products/products.service'
import { vaultService } from '../vault/vault.service'
import { generatePublicId } from '../../shared/lib/publicId'
import { appendAudit } from '../../shared/lib/audit'
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  BulkStockSchema,
  BulkImportPreviewSchema,
  BulkImportCommitSchema,
} from '../products/products.schema'

const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'
const VAULT_ITEMS = 'vault_items'

type AdminProductEnv = AuthEnv

export const adminProductRoutes = new Hono<AdminProductEnv>()

  .get('/', async (c) => {
    const allProducts = await productsService.listAll()

    const { data: stockCounts } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('product_id')
      .eq('status', 'AVAILABLE')

    const internalIdToPublic = new Map(allProducts.map((p: any) => [p.internalId, p.id]))
    const countByPublic = new Map<string, number>()
    for (const sc of stockCounts || []) {
      if (!sc.product_id) continue
      const pub = internalIdToPublic.get(sc.product_id)
      if (pub) countByPublic.set(pub, (countByPublic.get(pub) || 0) + 1)
    }

    const productsWithStock = allProducts.map((p: any) => ({
      ...p,
      internalId: undefined,
      stockCount: countByPublic.get(p.id) || 0,
    }))

    return c.json(productsWithStock)
  })

  .get('/bulk/template', async (c) => {
    return c.json(basisBulkService.template())
  })

  .post('/bulk/preview', zValidator('json', BulkImportPreviewSchema), async (c) => {
    const { csvText } = c.req.valid('json')
    return c.json(await basisBulkService.preview(csvText))
  })

  .post('/bulk/commit', zValidator('json', BulkImportCommitSchema), async (c) => {
    const { csvText, batchKey } = c.req.valid('json')
    const user = c.get('user')
    try {
      const result = await basisBulkService.commit(csvText, batchKey, { sub: user.sub, email: user.email })
      return c.json(result, 201)
    } catch (e: unknown) {
      // Row-level validation failures ride the error object (global handler
      // only ships {error}); unwrap here so the dialog gets row+column detail.
      if (e && typeof e === 'object' && 'issues' in e && (e as { status?: number }).status === 400) {
        return c.json({ error: (e as unknown as Error).message, issues: (e as { issues: unknown }).issues }, 400)
      }
      throw e
    }
  })

  .post('/', zValidator('json', ProductCreateSchema), async (c) => {
    const data = c.req.valid('json') as any
    const publicId = generatePublicId()
    const dbData: any = {
      public_id: publicId,
      name: data.name,
      category: data.category,
      badge: data.badge ?? null,
      overview: data.overview ?? null,
      description: data.description ?? null,
      instructions: data.instructions ?? null,
      is_active: data.isActive ?? true,
    }
    if (data.price !== undefined && data.price !== '') dbData.price = parseInt(data.price, 10)
    else dbData.price = 0

    const { data: created, error } = await supabaseAdmin
      .from(PRODUCTS)
      .insert(dbData)
      .select()
      .single()

    if (error) throw new Error(error.message)

    const user = c.get('user')
    await appendAudit({
      action: 'product:create',
      resourceType: 'product',
      resourcePublicId: publicId,
      resourceName: created?.name ?? '',
      snapshotText: `Produk ${created?.name} dibuat oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return c.json({ ...created, id: publicId }, 201)
  })

  .put('/:id', zValidator('json', ProductUpdateSchema), async (c) => {
    const publicId = c.req.param('id')
    const data = c.req.valid('json') as any
    const dbData: any = {
      name: data.name,
      category: data.category,
      badge: data.badge ?? null,
      overview: data.overview ?? null,
      description: data.description ?? null,
      instructions: data.instructions ?? null,
      is_active: data.isActive,
      updated_at: new Date().toISOString(),
    }
    if (data.price !== undefined && data.price !== '') dbData.price = parseInt(data.price, 10)

    const { data: updated, error } = await supabaseAdmin
      .from(PRODUCTS)
      .update(dbData)
      .eq('public_id', publicId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    if (!updated) return c.json({ error: 'Product not found' }, 404)

    if (data.isActive !== undefined) {
      const internalId = updated.id
      await supabaseAdmin
        .from(PRODUCT_VARIANTS)
        .update({ is_active: data.isActive })
        .eq('product_id', internalId)
    }

    const user = c.get('user')
    await appendAudit({
      action: 'product:update',
      resourceType: 'product',
      resourcePublicId: publicId,
      resourceName: updated.name ?? '',
      snapshotText: `Produk ${updated.name} diperbarui oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return c.json({ ...updated, id: publicId })
  })

  .delete('/:id', async (c) => {
    const publicId = c.req.param('id')
    const { data: base, error } = await supabaseAdmin
      .from(PRODUCTS)
      .select('id')
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!base || base.length === 0) return c.json({ error: 'Product not found' }, 404)

    const { count: variantCount } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('*', { count: 'exact', head: true })
      .eq('product_id', base[0].id)

    if ((variantCount || 0) > 0) {
      return c.json({ error: `Induk masih memiliki ${variantCount} varian. Pindahkan atau hapus varian dulu.` }, 409)
    }

    const { data: deleted, error: deleteError } = await supabaseAdmin
      .from(PRODUCTS)
      .delete()
      .eq('public_id', publicId)
      .select()
      .single()

    if (deleteError) throw new Error(deleteError.message)
    if (!deleted) return c.json({ error: 'Product not found' }, 404)

    const user = c.get('user')
    await appendAudit({
      action: 'product:delete',
      resourceType: 'product',
      resourcePublicId: publicId,
      resourceName: deleted.name ?? '',
      snapshotText: `Produk ${deleted.name} dihapus oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return c.json({ success: true })
  })

  .post('/:id/stock', zValidator('json', BulkStockSchema), async (c) => {
    const publicId = c.req.param('id')
    const { credentials } = c.req.valid('json')

    const lines = credentials
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) {
      return c.json({ error: 'No valid credential lines found' }, 400)
    }

    const { data: variant } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('id, name')
      .eq('public_id', publicId)
      .limit(1)

    if (variant && variant.length > 0) {
      const result = await vaultService.importCredentials(variant[0].id, lines)
      const user = c.get('user')
      await appendAudit({
        action: 'stock:import',
        resourceType: 'stock',
        resourcePublicId: publicId,
        resourceName: variant[0].name,
        snapshotText: `Stok ${result.imported} ditambah ke ${variant[0].name} (${publicId}) oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
        actorId: user.sub,
        actorEmail: user.email ?? null,
        actorType: 'admin',
      }).catch(() => {})
      return c.json(result)
    }

    const { data: product } = await supabaseAdmin
      .from(PRODUCTS)
      .select('id, name')
      .eq('public_id', publicId)
      .limit(1)

    if (!product || product.length === 0) return c.json({ error: 'Product not found' }, 404)

    const result = await vaultService.importCredentials(product[0].id, lines)
    const user = c.get('user')
    await appendAudit({
      action: 'stock:import',
      resourceType: 'stock',
      resourcePublicId: publicId,
      resourceName: product[0].name,
      snapshotText: `Stok ${result.imported} ditambah ke ${product[0].name} (${publicId}) oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return c.json(result)
  })
