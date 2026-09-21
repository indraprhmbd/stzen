import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { generatePublicId } from '../../shared/lib/publicId'
import { generateSku, composeVariantName } from '../../shared/lib/sku'
import { BulkStockSchema, BulkStatusSchema, BulkImportPreviewSchema, BulkImportCommitSchema } from '../products/products.schema'
import { varianBulkService, variantStatusService } from '../products/products.service'
import { stokBulkService } from '../vault/vault.service'
import { vaultService } from '../vault/vault.service'
import { appendAudit } from '../../shared/lib/audit'
import { getStockCounts } from '../../shared/lib/db-helpers'

const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'

const VariantCreateSchema = z.object({
  productId: z.string().min(1),
  price: z.string().regex(/^\d+$/, 'Price integer'),
  compareAtPrice: z.string().regex(/^\d+$/, 'Compare price integer').nullable().optional(),
  costPrice: z.string().regex(/^\d+$/, 'Cost price integer').nullable().optional(),
  badge: z.string().nullable().optional(),
  overview: z.string().max(200).nullable().optional(),
  description: z.string().nullable().optional(),
  durationMonths: z.number().int().nullable().optional(),
  durationUnit: z.enum(['day', 'week', 'month']).optional().default('month'),
  accountType: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
  fulfillmentType: z.enum(['vault', 'on_demand']).optional().default('vault'),
  requiresDeliveryInfo: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const VariantUpdateSchema = z.object({
  productId: z.string().optional(),
  price: z.string().regex(/^\d+$/, 'Price integer').optional(),
  compareAtPrice: z.string().regex(/^\d+$/, 'Compare price integer').nullable().optional(),
  costPrice: z.string().regex(/^\d+$/, 'Cost price integer').nullable().optional(),
  badge: z.string().nullable().optional(),
  overview: z.string().max(200).nullable().optional(),
  description: z.string().nullable().optional(),
  durationMonths: z.number().int().nullable().optional(),
  durationUnit: z.enum(['day', 'week', 'month']).optional(),
  accountType: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
  fulfillmentType: z.enum(['vault', 'on_demand']).optional(),
  requiresDeliveryInfo: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

type VariantEnv = AuthEnv
export const adminVariantRoutes = new Hono<VariantEnv>()

  .get('/bulk/template', async (c) => {
    return c.json(varianBulkService.template())
  })

  .post('/bulk/preview', zValidator('json', BulkImportPreviewSchema), async (c) => {
    const { csvText } = c.req.valid('json')
    return c.json(await varianBulkService.preview(csvText))
  })

  .post('/bulk/commit', zValidator('json', BulkImportCommitSchema), async (c) => {
    const { csvText, batchKey } = c.req.valid('json')
    const user = c.get('user')
    try {
      const result = await varianBulkService.commit(csvText, batchKey, { sub: user.sub, email: user.email })
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

  // Checkbox bulk: activate/deactivate up to 20 varian; unknown ids and
  // already-target rows skip with reasons instead of failing the batch.
  .post('/bulk/status', zValidator('json', BulkStatusSchema), async (c) => {
    const { action, ids } = c.req.valid('json')
    const user = c.get('user')
    return c.json(await variantStatusService.setActive(ids, action === 'activate', { sub: user.sub, email: user.email }))
  })

  .get('/bulk-stock/template', async (c) => {
    return c.json(stokBulkService.template())
  })

  .post('/bulk-stock/preview', zValidator('json', BulkImportPreviewSchema), async (c) => {
    const { csvText } = c.req.valid('json')
    return c.json(await stokBulkService.preview(csvText))
  })

  .post('/bulk-stock/commit', zValidator('json', BulkImportCommitSchema), async (c) => {
    const { csvText, batchKey } = c.req.valid('json')
    const user = c.get('user')
    try {
      const result = await stokBulkService.commit(csvText, batchKey, { sub: user.sub, email: user.email })
      return c.json(result, 201)
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'issues' in e && (e as { status?: number }).status === 400) {
        return c.json({ error: (e as unknown as Error).message, issues: (e as { issues: unknown }).issues }, 400)
      }
      throw e
    }
  })

  .get('/', async (c) => {
    // ?compact=1: 5-column projection for dropdowns (manual-order picker).
    // The full 18-field rows stay on the default path for ProductsPage.
    if (c.req.query('compact') === '1') {
      const { data, error } = await supabaseAdmin
        .from(PRODUCT_VARIANTS)
        .select('public_id, name, price, is_active, requires_delivery_info')
        .order('name', { ascending: true })
      if (error) throw new Error(error.message)
      return c.json((data || []).map((v: any) => ({
        id: v.public_id,
        name: v.name,
        price: v.price,
        isActive: v.is_active,
        requiresDeliveryInfo: v.requires_delivery_info ?? false,
      })))
    }

    const { data: variants, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select(`
        id,
        public_id,
        sku,
        name,
        price,
        compare_at_price,
        cost_price,
        badge,
        duration_months,
        duration_unit,
        account_type,
        conditions,
        fulfillment_type,
        requires_delivery_info,
        is_active,
        product_id,
        created_at,
        updated_at,
        ${PRODUCTS} (
          id,
          public_id,
          name,
          category
        )
      `)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    const variantIds = (variants || []).map((v: any) => v.id)
    const stockByVariant = await getStockCounts(variantIds)

    const withStock = (variants || []).map((v: any) => {
      const product = Array.isArray(v.products) ? v.products[0] : (v.products || {})
      return {
        id: v.public_id,
        publicId: v.public_id,
        internalId: v.id,
        productId: product?.public_id,
        internalProductId: v.product_id,
        sku: v.sku,
        name: v.name,
        price: v.price,
        compareAtPrice: v.compare_at_price,
        costPrice: v.cost_price ?? null,
        badge: v.badge,
        durationMonths: v.duration_months,
        durationUnit: v.duration_unit,
        accountType: v.account_type,
        conditions: v.conditions,
        fulfillmentType: v.fulfillment_type,
        requiresDeliveryInfo: v.requires_delivery_info ?? false,
        isActive: v.is_active,
        baseName: product?.name,
        category: product?.category,
        createdAt: v.created_at,
        stockCount: v.fulfillment_type === 'on_demand' ? 9999 : (stockByVariant.get(v.id) ?? 0),
      }
    })

    return c.json(withStock)
  })

  .get('/:id/detail', async (c) => {
    const publicId = c.req.param('id')
    const { data: rows, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('overview, description')
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) return c.json({ error: 'Variant not found' }, 404)

    return c.json(rows[0])
  })

  .post('/', zValidator('json', VariantCreateSchema), async (c) => {
    const data = c.req.valid('json') as any

    let baseName = 'Product'
    let baseId: string | null = null

    const { data: base } = await supabaseAdmin
      .from(PRODUCTS)
      .select('id, name')
      .eq('public_id', data.productId)
      .limit(1)

    if (base && base.length > 0) {
      baseName = base[0]!.name
      baseId = base[0]!.id
    } else {
      const { data: base2 } = await supabaseAdmin
        .from(PRODUCTS)
        .select('id, name')
        .eq('id', data.productId)
        .limit(1)

      if (base2 && base2.length > 0) {
        baseName = base2[0]!.name
        baseId = base2[0]!.id
      }
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

    const { data: created, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .insert({
        public_id: publicId,
        product_id: baseId,
        sku,
        name,
        price: priceInt,
        compare_at_price: compareAt,
        cost_price: data.costPrice ? parseInt(data.costPrice, 10) : null,
        badge: data.badge,
        overview: data.overview ?? null,
        description: data.description ?? null,
        duration_months: data.durationMonths,
        account_type: data.accountType,
        conditions: data.conditions,
        fulfillment_type: data.fulfillmentType ?? 'vault',
        requires_delivery_info: data.requiresDeliveryInfo ?? false,
        is_active: data.isActive ?? true,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    const user = c.get('user')
    await appendAudit({
      action: 'variant:create',
      resourceType: 'variant',
      resourcePublicId: publicId,
      resourceName: created?.name ?? sku,
      snapshotText: `Varian ${sku} dibuat oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
    }).catch((e) => console.error('[audit] admin variant action failed', e))

    return c.json({ ...created, id: publicId, sku, name }, 201)
  })

  .put('/:id', zValidator('json', VariantUpdateSchema), async (c) => {
    const publicId = c.req.param('id')
    const data = c.req.valid('json') as any

    try {
      if (data.price !== undefined) data.price = parseInt(data.price, 10)
      if (data.costPrice !== undefined) data.costPrice = !data.costPrice ? null : parseInt(data.costPrice, 10)
      if (data.compareAtPrice !== undefined) {
        data.compareAtPrice = !data.compareAtPrice ? null : parseInt(data.compareAtPrice, 10)
        if (data.compareAtPrice !== null) {
          let effPrice = data.price
          if (effPrice === undefined) {
            const { data: cur } = await supabaseAdmin
              .from(PRODUCT_VARIANTS)
              .select('price')
              .eq('public_id', publicId)
              .limit(1)
            effPrice = cur?.[0]?.price
          }
          if (effPrice === undefined || data.compareAtPrice <= effPrice) data.compareAtPrice = null
        }
      }

      if (data.productId !== undefined && data.productId !== '') {
        const { data: p } = await supabaseAdmin
          .from(PRODUCTS)
          .select('id')
          .eq('public_id', data.productId)
          .limit(1)
        data.productId = p?.[0]?.id ?? null
      } else if (data.productId === '') {
        data.productId = null
      }

      if (data.durationMonths !== undefined || data.durationUnit !== undefined || data.accountType !== undefined || data.conditions !== undefined || data.productId) {
        const { data: cur } = await supabaseAdmin
          .from(PRODUCT_VARIANTS)
          .select('*')
          .eq('public_id', publicId)
          .limit(1)

        if (cur && cur.length > 0) {
          const current = cur[0]
          const targetBaseId = data.productId ?? current.product_id
          const { data: base } = targetBaseId ? await supabaseAdmin
            .from(PRODUCTS)
            .select('name')
            .eq('id', targetBaseId)
            .limit(1) : { data: [{ name: current.name }] }

          const baseName = base?.[0]?.name ?? current.name
          const unit = data.durationUnit ?? current.duration_unit ?? 'month'
          data.name = composeVariantName(baseName, data.durationMonths ?? current.duration_months, unit, data.accountType ?? current.account_type, data.conditions ?? current.conditions)
          if (data.durationMonths !== undefined || data.durationUnit !== undefined || data.accountType !== undefined || data.productId) {
            data.sku = generateSku(baseName, data.durationMonths ?? current.duration_months, unit, data.accountType ?? current.account_type)
          }
        }
      }

      const updateData: any = { updated_at: new Date().toISOString() }
      delete updateData.id
      if (data.productId !== undefined) updateData.product_id = data.productId
      if (data.price !== undefined) updateData.price = data.price
      if (data.compareAtPrice !== undefined) updateData.compare_at_price = data.compareAtPrice
      if (data.costPrice !== undefined) updateData.cost_price = data.costPrice
      if (data.badge !== undefined) updateData.badge = data.badge
      if (data.overview !== undefined) updateData.overview = data.overview
      if (data.description !== undefined) updateData.description = data.description
      if (data.durationMonths !== undefined) updateData.duration_months = data.durationMonths
      if (data.durationUnit !== undefined) updateData.duration_unit = data.durationUnit
      if (data.accountType !== undefined) updateData.account_type = data.accountType
      if (data.conditions !== undefined) updateData.conditions = data.conditions
      if (data.fulfillmentType !== undefined) updateData.fulfillment_type = data.fulfillmentType
      if (data.requiresDeliveryInfo !== undefined) updateData.requires_delivery_info = data.requiresDeliveryInfo
      if (data.isActive !== undefined) updateData.is_active = data.isActive
      if (data.name !== undefined) updateData.name = data.name
      if (data.sku !== undefined) updateData.sku = data.sku
      for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined) delete updateData[key]
      }

      const { data: updated, error } = await supabaseAdmin
        .from(PRODUCT_VARIANTS)
        .update(updateData)
        .eq('public_id', publicId)
        .select()
        .single()

      if (error) throw new Error(error.message)
      if (!updated) return c.json({ error: 'Variant not found' }, 404)

      const user = c.get('user')
      await appendAudit({
        action: 'variant:update',
        resourceType: 'variant',
        resourcePublicId: publicId,
        resourceName: updated.name ?? '',
        snapshotText: `Varian ${updated.name} diperbarui oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
        actorId: user.sub,
        actorEmail: user.email ?? null,
        actorType: 'admin',
      }).catch((e) => console.error('[audit] admin variant action failed', e))

      return c.json({ ...updated, id: publicId })
    } catch (err) {
      console.error('[variant:update] failed', { publicId, data, err })
      throw err
    }
  })

  .delete('/:id', async (c) => {
    const publicId = c.req.param('id')
    const { data: deleted, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .delete()
      .eq('public_id', publicId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    if (!deleted) return c.json({ error: 'Variant not found' }, 404)

    const user = c.get('user')
    await appendAudit({
      action: 'variant:delete',
      resourceType: 'variant',
      resourcePublicId: publicId,
      resourceName: deleted.name ?? '',
      snapshotText: `Varian ${deleted.name} dihapus oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
    }).catch((e) => console.error('[audit] admin variant action failed', e))

    return c.json({ success: true })
  })

  .post('/:id/stock', zValidator('json', BulkStockSchema), async (c) => {
    const publicId = c.req.param('id')
    const { credentials } = c.req.valid('json')
    if (!credentials || !credentials.trim()) return c.json({ error: 'No valid credential lines' }, 400)

    const { data: variant, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('id, name, fulfillment_type')
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!variant || variant.length === 0) return c.json({ error: 'Variant not found' }, 404)
    if (variant[0]!.fulfillment_type === 'on_demand') return c.json({ error: 'Varian on demand tidak memerlukan impor stok' }, 400)

    const lines = credentials.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
    const result = await vaultService.importCredentials(variant[0]!.id, lines)

    const user = c.get('user')
    await appendAudit({
      action: 'stock:import',
      resourceType: 'stock',
      resourcePublicId: publicId,
      resourceName: variant[0]!.name,
      snapshotText: `Stok ${result.imported} ditambah ke ${variant[0]!.name} (${publicId}) oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
    }).catch((e) => console.error('[audit] admin variant action failed', e))

    return c.json(result)
  })
