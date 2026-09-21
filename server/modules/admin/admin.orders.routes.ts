import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { ordersService, auditOrderApprove } from '../orders/orders.service'
import { warrantyService } from '../orders/warranty.service'
import { insertOrderNote, listOrderNotes } from '../../shared/lib/notes'
import { appendAudit, findAuditByIdempotencyKey } from '../../shared/lib/audit'
import { normalizeWaNumber } from '../../shared/lib/wa'
import { BadRequestError } from '../../shared/errors/http'

const PROFILES = 'profiles'
const PRODUCT_VARIANTS = 'product_variants'
const PRODUCTS = 'products'
const ORDERS = 'orders'

const DeliverSchema = z.object({ credential: z.string().max(5000).optional() })

// Bulk approve (selection bar). Literal action keeps the door open for
// future bulk actions without overbuilding; 20-cap matches reminders bulk.
const BulkApproveSchema = z.object({
  action: z.literal('approve'),
  ids: z.array(z.string().min(1)).min(1).max(20),
})

const ManualOrderSchema = z.object({  customerEmail: z.string().email(),
  variantId: z.string().min(1),
  paymentRef: z.string().max(120).nullable().optional(),
  // Optional override (deal price, rounding, promo). Raw digits; variant
  // catalog price applies when omitted.
  amount: z.string().regex(/^\d+$/, 'Harga integer').optional(),
  // Delivery contact (admin-collected). Required iff the variant's
  // requires_delivery_info flag is on (enforced below from the DB row).
  customerAccount: z.string().max(120).optional(),
  waNumber: z.string().max(32).optional(),
})

// Manual review approve: amount/contact edits + approve (+allocate vault)
// in one call. PENDING + manual rail only; enforced in the service.
const ApproveManualSchema = z.object({
  amount: z.string().regex(/^\d+$/, 'Harga integer').optional(),
  paymentRef: z.string().max(120).nullable().optional(),
  customerAccount: z.string().max(120).optional(),
  waNumber: z.string().max(32).optional(),
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

  .post('/bulk', zValidator('json', BulkApproveSchema), async (c) => {
    const user = c.get('user')
    const { ids } = c.req.valid('json')
    // Manual-provider rows skip bulk: they need the per-row review form.
    const inspect = (id: string) =>
      ordersService.getById(id)
        .then((o) => ({ paymentProvider: (o as any).paymentProvider ?? null }))
        .catch(() => null)
    return c.json(await ordersService.bulkApprove(ids, { sub: user.sub, email: user.email ?? null }, { inspect }))
  })

  .post('/:id/approve', async (c) => {
    const user = c.get('user')
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior)
    }
    const order = await ordersService.transitionStatus(c.req.param('id'), 'approve')
    await auditOrderApprove(order, { sub: user.sub, email: user.email ?? null }, idempotencyKey)
    return c.json(order)
  })

  .post('/:id/approve-manual', zValidator('json', ApproveManualSchema), async (c) => {
    const user = c.get('user')
    const idempotencyKey = c.req.header('Idempotency-Key') || undefined
    if (idempotencyKey) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      if (prior) return c.json(prior)
    }
    const out = await ordersService.approveManual(c.req.param('id'), c.req.valid('json'))
    if (out.priceChanged || out.contactChanged || (out as any).refChanged) {
      const bits: string[] = []
      if (out.priceChanged) bits.push(`harga Rp ${Number(out.prevAmount).toLocaleString('id-ID')} -> Rp ${Number((out.order as any).amount).toLocaleString('id-ID')}`)
      if (out.contactChanged) bits.push('kontak diperbarui')
      if ((out as any).refChanged) bits.push('ref diperbarui')
      await appendAudit({
        action: 'order:update',
        resourceType: 'order',
        resourcePublicId: (out.order as any).publicId ?? c.req.param('id'),
        resourceName: (out.order as any).productName ?? '',
        snapshotText: `Order ${(out.order as any).publicId ?? c.req.param('id')} review manual (${bits.join(', ')}) oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
        actorId: user.sub,
        actorEmail: user.email ?? null,
        actorType: 'admin',
        diff: { prevAmount: out.prevAmount, order: out.order },
        idempotencyKey,
      }).catch((e) => console.error('[audit] admin order action failed', e))
    }
    await auditOrderApprove(out.order, { sub: user.sub, email: user.email ?? null }, idempotencyKey)
    return c.json(out)
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
    const { customerEmail, variantId, paymentRef, amount, customerAccount, waNumber } = c.req.valid('json')

    // Auth stores emails lowercase; exact-match lookup would 404 on
    // `User@Mail.com`, so normalize before comparing.
    const normalizedEmail = customerEmail.trim().toLowerCase()
    const { data: profile, error } = await supabaseAdmin
      .from(PROFILES)
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!profile || profile.length === 0) return c.json({ error: 'Pelanggan tidak ditemukan' }, 404)

    const { data: variant } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('*')
      .eq('public_id', variantId)
      .limit(1)

    if (!variant || variant.length === 0) return c.json({ error: 'Varian tidak ditemukan' }, 404)

    // Contact required iff the variant's flag is on (same rules as
    // checkout); ignored blanks otherwise so the review form stays lean.
    let finalAccount = ''
    let finalWa = ''
    if (variant[0]!.requires_delivery_info === true) {
      const account = (customerAccount ?? '').trim()
      if (account.length < 3 || account.length > 120) throw new BadRequestError('Akun tujuan wajib diisi (3-120 karakter)')
      const wa = normalizeWaNumber(waNumber ?? '')
      if (!wa) throw new BadRequestError('Nomor WA tidak valid (format 08..)')
      finalAccount = account
      finalWa = wa
    }

    let baseName: string | null = null
    if (variant[0]!.product_id) {
      const { data: base } = await supabaseAdmin
        .from(PRODUCTS)
        .select('name')
        .eq('id', variant[0]!.product_id)
        .limit(1)
      baseName = base?.[0]?.name ?? null
    }

    const finalAmount = amount ?? String(variant[0]!.price)
    const customPrice = amount !== undefined && amount !== String(variant[0]!.price)
    const order = await ordersService.create({
      userId: profile[0]!.id,
      productId: variant[0]!.product_id,
      variantId: variant[0]!.id,
      amount: finalAmount,
      paymentProvider: 'manual',
      customerAccount: finalAccount,
      waNumber: finalWa,
      variantSnapshot: {
        name: variant[0]!.name,
        sku: variant[0]!.sku,
        duration_months: variant[0]!.duration_months,
        duration_unit: variant[0]!.duration_unit,
        account_type: variant[0]!.account_type,
        conditions: variant[0]!.conditions,
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
      resourceName: variant[0]!.name,
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
    // Refund amount is recomputed server-side (never trusts a client
    // number). NULL when uncomputable (no duration snapshot) = legacy
    // full-manual refund; overview falls back to amount in that case.
    const id = c.req.param('id')
    let refundAmount: number | null = null
    try {
      const preview = await warrantyService.getRefundPreview(id)
      refundAmount = preview.preview?.refund ?? null
    } catch {
      refundAmount = null
    }
    const order = await ordersService.transitionStatus(id, 'refund')
    if (refundAmount != null) {
      const { error } = await supabaseAdmin
        .from(ORDERS)
        .update({ refund_amount: refundAmount })
        .eq('public_id', id)
      if (error) throw new Error(error.message)
    }
    await appendAudit({
      action: 'order:refund',
      resourceType: 'order',
      resourcePublicId: (order as any).publicId ?? id,
      resourceName: (order as any).productName ?? '',
      snapshotText: `Order ${(order as any).publicId ?? id} ->REFUNDED oleh ${user.email ?? user.sub}${refundAmount != null ? ` (Rp ${refundAmount.toLocaleString('id-ID')})` : ''} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
      diff: { ...(order as any), refundAmount },
      idempotencyKey,
    }).catch((e) => console.error('[audit] admin order action failed', e))
    return c.json({ ...(order as any), refundAmount })
  })

  .get('/:id/refund-preview', async (c) => {
    const preview = await warrantyService.getRefundPreview(c.req.param('id'))
    return c.json(preview)
  })

  .get('/:id/notes', async (c) => {
    return c.json(await listOrderNotes(c.req.param('id')))
  })

  .post('/:id/notes', zValidator('json', z.object({ note: z.string().trim().min(1).max(500) })), async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const { note } = c.req.valid('json')
    const saved = await insertOrderNote(id, note, { sub: user.sub, email: user.email ?? null })
    await appendAudit({
      action: 'order:note',
      resourceType: 'order',
      resourcePublicId: id,
      snapshotText: `Catatan oleh ${user.email ?? user.sub}: ${note} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
    }).catch((e) => console.error('[audit] admin order note failed', e))
    return c.json(saved)
  })
