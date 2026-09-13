import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { ordersService } from '../orders/orders.service'
import { appendAudit, findAuditByIdempotencyKey } from '../../shared/lib/audit'

const PROFILES = 'profiles'
const PRODUCT_VARIANTS = 'product_variants'
const PRODUCTS = 'products'
const ORDERS = 'orders'

const DeliverSchema = z.object({ credential: z.string().max(5000).optional() })

const ManualOrderSchema = z.object({
  customerEmail: z.string().email(),
  variantId: z.string().min(1),
  paymentRef: z.string().max(120).nullable().optional(),
  // Optional override (deal price, rounding, promo). Raw digits; variant
  // catalog price applies when omitted.
  amount: z.string().regex(/^\d+$/, 'Harga integer').optional(),
})

type AdminOrderEnv = AuthEnv

export const adminOrderRoutes = new Hono<AdminOrderEnv>()

  .get('/', zValidator('query', z.object({
    status: z.string().optional(),
    q: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
    oldest: z.string().optional(),
    sort: z.string().optional(),
    sortDir: z.string().optional(),
  })), async (c) => {
    const status = c.req.query('status') || undefined
    const q = c.req.query('q') || undefined
    const { limit, offset } = c.req.valid('query')
    const oldest = c.req.query('oldest') === '1'
    const sort = c.req.query('sort') || undefined
    const sortDir = c.req.query('sortDir') || undefined
    const result = await ordersService.listAll({ status, q, limit, offset, oldest, sort, sortDir })
    return c.json(result)
  })

  .post('/:id/approve', async (c) => {
    const user = c.get('user')
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior)
    }
    const order = await ordersService.transitionStatus(c.req.param('id'), 'approve')
    await appendAudit({
      action: 'order:approve',
      resourceType: 'order',
      resourcePublicId: (order as any).publicId ?? c.req.param('id'),
      resourceName: (order as any).productName ?? '',
      snapshotText: `Order ${(order as any).publicId ?? c.req.param('id')} PENDING->PAID oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
      diff: order,
      idempotencyKey,
    }).catch((e) => console.error('[audit] admin order action failed', e))
    return c.json(order)
  })

  .post('/:id/reject', async (c) => {
    const user = c.get('user')
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior)
    }
    const order = await ordersService.transitionStatus(c.req.param('id'), 'reject')
    await appendAudit({
      action: 'order:reject',
      resourceType: 'order',
      resourcePublicId: (order as any).publicId ?? c.req.param('id'),
      resourceName: (order as any).productName ?? '',
      snapshotText: `Order ${(order as any).publicId ?? c.req.param('id')} PENDING->REJECTED oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
      diff: order,
      idempotencyKey,
    }).catch((e) => console.error('[audit] admin order action failed', e))
    return c.json(order)
  })

  .post('/:id/deliver', zValidator('json', DeliverSchema), async (c) => {
    const user = c.get('user')
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior)
    }
    const { credential } = c.req.valid('json')
    const order = await ordersService.deliverWithCredential(c.req.param('id'), credential)
    await appendAudit({
      action: 'order:deliver',
      resourceType: 'order',
      resourcePublicId: (order as any).publicId ?? c.req.param('id'),
      resourceName: (order as any).productName ?? '',
      snapshotText: `Order ${(order as any).publicId ?? c.req.param('id')} PAID->DELIVERED oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
      diff: order,
      idempotencyKey,
    }).catch((e) => console.error('[audit] admin order action failed', e))
    return c.json(order)
  })

  .post('/manual', zValidator('json', ManualOrderSchema), async (c) => {
    const user = c.get('user')
    const { customerEmail, variantId, paymentRef, amount } = c.req.valid('json')

    const { data: profile, error } = await supabaseAdmin
      .from(PROFILES)
      .select('id')
      .eq('email', customerEmail)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!profile || profile.length === 0) return c.json({ error: 'Pelanggan tidak ditemukan' }, 404)

    const { data: variant } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('*')
      .eq('public_id', variantId)
      .limit(1)

    if (!variant || variant.length === 0) return c.json({ error: 'Varian tidak ditemukan' }, 404)

    let baseName: string | null = null
    if (variant[0].product_id) {
      const { data: base } = await supabaseAdmin
        .from(PRODUCTS)
        .select('name')
        .eq('id', variant[0].product_id)
        .limit(1)
      baseName = base?.[0]?.name ?? null
    }

    const finalAmount = amount ?? String(variant[0].price)
    const customPrice = amount !== undefined && amount !== String(variant[0].price)
    const order = await ordersService.create({
      userId: profile[0].id,
      productId: variant[0].product_id,
      variantId: variant[0].id,
      amount: finalAmount,
      variantSnapshot: {
        name: variant[0].name,
        sku: variant[0].sku,
        durationMonths: variant[0].duration_months,
        accountType: variant[0].account_type,
        conditions: variant[0].conditions,
        baseName,
      },
    })

    const orderPublicId = (order as any).publicId ?? (order as any).id
    if (paymentRef) {
      const { error: updateError } = await supabaseAdmin
        .from(ORDERS)
        .update({ payment_ref: paymentRef })
        .eq('public_id', orderPublicId)

      if (updateError) throw new Error(updateError.message)
    }

    await appendAudit({
      action: 'order:create',
      resourceType: 'order',
      resourcePublicId: orderPublicId,
      resourceName: variant[0].name,
      snapshotText: `Order ${orderPublicId} dibuat manual untuk ${customerEmail} oleh ${user.email ?? user.sub}${customPrice ? ` (harga khusus Rp ${Number(finalAmount).toLocaleString('id-ID')})` : ''} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
      diff: order,
    }).catch((e) => console.error('[audit] admin order action failed', e))

    return c.json(order, 201)
  })

  .post('/:id/refund', async (c) => {
    const user = c.get('user')
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior)
    }
    const order = await ordersService.transitionStatus(c.req.param('id'), 'refund')
    await appendAudit({
      action: 'order:refund',
      resourceType: 'order',
      resourcePublicId: (order as any).publicId ?? c.req.param('id'),
      resourceName: (order as any).productName ?? '',
      snapshotText: `Order ${(order as any).publicId ?? c.req.param('id')} PAID->REFUNDED oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
      diff: order,
      idempotencyKey,
    }).catch((e) => console.error('[audit] admin order action failed', e))
    return c.json(order)
  })
