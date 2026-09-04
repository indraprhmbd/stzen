import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { orders, profiles, products, productVariants } from '../../shared/db/schema'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { ordersService } from '../orders/orders.service'
import { appendAudit, findAuditByIdempotencyKey } from '../../shared/lib/audit'

// ─── Admin Order Routes ─────────────────────────────────────────────────────

type AdminOrderEnv = AuthEnv

export const adminOrderRoutes = new Hono<AdminOrderEnv>()

// Auth is enforced globally in app.ts; this only adds the role check.
adminOrderRoutes.use('*', requireRole('admin'))

// GET / — Paginated orders with optional status filter and search
adminOrderRoutes.get('/', async (c) => {
  const status = c.req.query('status') || undefined
  const q = c.req.query('q') || undefined
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10) || 20, 100)
  const offset = Math.max(parseInt(c.req.query('offset') || '0', 10) || 0, 0)
  const oldest = c.req.query('oldest') === '1'
  const result = await ordersService.listAll({ status, q, limit, offset, oldest })
  return c.json(result)
})

// POST /:id/approve — Approve payment: PENDING -> PAID
adminOrderRoutes.post('/:id/approve', async (c) => {
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
    diff: order,
    idempotencyKey,
  }).catch((e) => console.error('[audit] admin order action failed', e))
  return c.json(order)
})

// POST /:id/reject — Reject payment: PENDING -> REJECTED
adminOrderRoutes.post('/:id/reject', async (c) => {
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
    diff: order,
    idempotencyKey,
  }).catch((e) => console.error('[audit] admin order action failed', e))
  return c.json(order)
})

const DeliverSchema = z.object({ credential: z.string().max(5000).optional() })

// POST /:id/deliver — Flow-aware delivery: PAID -> DELIVERED with allocation.
// Optional { credential } body for on-demand variants (imported + allocated
// atomically). Vault variants with zero stock get 409 STOK_HABIS. The raw
// credential is never written to audit logs.
adminOrderRoutes.post('/:id/deliver', zValidator('json', DeliverSchema), async (c) => {
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
    diff: order,
    idempotencyKey,
  }).catch((e) => console.error('[audit] admin order action failed', e))
  return c.json(order)
})

const ManualOrderSchema = z.object({
  customerEmail: z.string().email(),
  variantId: z.string().min(1),
  paymentRef: z.string().max(120).nullable().optional(),
})

// POST /manual — Admin creates PENDING order on behalf of a customer
adminOrderRoutes.post('/manual', zValidator('json', ManualOrderSchema), async (c) => {
  const user = c.get('user')
  const { customerEmail, variantId, paymentRef } = c.req.valid('json')
  const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, customerEmail))
  if (!profile) return c.json({ error: 'Pelanggan tidak ditemukan' }, 404)
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.publicId, variantId))
  if (!variant) return c.json({ error: 'Varian tidak ditemukan' }, 404)
  let baseName: string | null = null
  if (variant.productId) {
    const [base] = await db.select({ name: products.name }).from(products).where(eq(products.id, variant.productId))
    baseName = base?.name ?? null
  }
  const order = await ordersService.create({
    userId: profile.id,
    productId: variant.productId,
    variantId: variant.id,
    amount: variant.price,
    variantSnapshot: {
      name: variant.name,
      sku: variant.sku,
      durationMonths: variant.durationMonths,
      accountType: variant.accountType,
      conditions: variant.conditions,
      baseName,
    },
  })
  const orderPublicId = (order as any).publicId ?? (order as any).id
  if (paymentRef) {
    await db.update(orders).set({ paymentRef }).where(eq(orders.publicId, orderPublicId))
  }
  await appendAudit({
    action: 'order:create',
    resourceType: 'order',
    resourcePublicId: orderPublicId,
    resourceName: variant.name,
    snapshotText: `Order ${orderPublicId} dibuat manual untuk ${customerEmail} oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
    actorId: user.sub,
    actorEmail: user.email ?? null,
    diff: order,
  }).catch((e) => console.error('[audit] admin order action failed', e))
  return c.json(order, 201)
})

// POST /:id/refund — Refund payment: PAID -> REFUNDED, releases vault stock
adminOrderRoutes.post('/:id/refund', async (c) => {
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
    diff: order,
    idempotencyKey,
  }).catch((e) => console.error('[audit] admin order action failed', e))
  return c.json(order)
})
