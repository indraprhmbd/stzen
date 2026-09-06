import { eq, desc, sql, ilike, or, and, inArray } from 'drizzle-orm'
import { db } from '../../shared/db'
import { orders, products, productVariants, profiles, vaultItems } from '../../shared/db/schema'
import type { PayableOrder } from './orders.types'
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/http'
import { generatePublicId } from '../../shared/lib/publicId'
import { allocateCredential, getStockCounts } from '../../shared/lib/db-helpers'
import { importKeyFromBase64, encrypt } from '../../shared/lib/crypto'
import {
  type OrderWithProduct,
  type OrderAction,
  VALID_TRANSITIONS,
  ACTION_TO_STATUS,
} from './orders.types'

// ─── Orders Service ─────────────────────────────────────────────────────────
// Business logic for order management. Centralized state machine.

// 30s cache for statusCounts — runs full GROUP BY on orders table.
// Stale window acceptable for badge counts; saves 1 full scan per
// paginated request when multiple tabs load simultaneously.
let statusCountsCache: { data: any[]; ts: number } | null = null
async function getStatusCounts(): Promise<any[]> {
  if (statusCountsCache && Date.now() - statusCountsCache.ts < 30_000) return statusCountsCache.data
  const rows = await db
    .select({ status: orders.status, count: sql<number>`cast(count(*) as int)` })
    .from(orders)
    .groupBy(orders.status)
  statusCountsCache = { data: rows, ts: Date.now() }
  return rows
}

export const ordersService = {
  async listByUser(userId: string): Promise<OrderWithProduct[]> {
    const rows = await db
      .select({
        id: orders.publicId,
        userId: orders.userId,
        productId: orders.productId,
        variantId: orders.variantId,
        vaultItemId: orders.vaultItemId,
        status: orders.status,
        paymentRef: orders.paymentRef,
        paymentProvider: orders.paymentProvider,
        amount: orders.amount,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        productName: products.name,
        productCategory: products.category,
        variantNameSnapshot: orders.variantNameSnapshot,
        baseNameSnapshot: orders.baseNameSnapshot,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
    return rows.map((r: any) => ({
      ...r,
      productName: r.variantNameSnapshot ?? r.baseNameSnapshot ?? r.productName ?? 'Produk',
      productCategory: r.productCategory ?? '',
    }))
  },

  async getById(publicId: string, userId?: string): Promise<OrderWithProduct> {
    const [order] = await db
      .select({
        id: orders.publicId,
        userId: orders.userId,
        productId: orders.productId,
        variantId: orders.variantId,
        vaultItemId: orders.vaultItemId,
        status: orders.status,
        paymentRef: orders.paymentRef,
        paymentProvider: orders.paymentProvider,
        amount: orders.amount,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        productName: products.name,
        productCategory: products.category,
        variantNameSnapshot: orders.variantNameSnapshot,
        baseNameSnapshot: orders.baseNameSnapshot,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.publicId, publicId))

    if (!order) {
      throw new NotFoundError('Order not found')
    }

    if (userId && order.userId !== userId) {
      throw new NotFoundError('Order not found')
    }

    return {
      ...order,
      productName: (order as any).variantNameSnapshot ?? (order as any).baseNameSnapshot ?? (order as any).productName ?? 'Produk',
      productCategory: (order as any).productCategory ?? '',
    } as any
  },

  // ─── Buyer self-cancel ────────────────────────────────────────────────────
  // Owner-only hard delete of a dead PENDING row (e.g. gateway initiate
  // failed, invoice never minted). Blocked once payment_ref exists — a live
  // gateway invoice is outstanding, admin must void it. Audit trail stays in
  // audit_logs (order:create + initiate attempts); nothing payable is lost.
  async deleteOwnOrder(publicId: string, userId: string) {
    const order = await this.getById(publicId, userId)
    if (order.status !== 'PENDING') {
      throw new ConflictError('Only PENDING orders can be cancelled')
    }
    if (order.paymentRef) {
      throw new ConflictError('Order already invoiced, contact admin to cancel')
    }
    await db.delete(orders).where(eq(orders.publicId, publicId))
    return { ok: true }
  },

  async create(data: { userId: string; productId?: string | null; variantId?: string; amount: string | number; variantSnapshot?: any }) {
    const publicId = generatePublicId()
    const amountInt = typeof data.amount === 'string' ? parseInt(data.amount, 10) : data.amount
    const vs: any = data.variantSnapshot
    const [order] = await db
      .insert(orders)
      .values({
        publicId,
        userId: data.userId,
        productId: data.productId ?? null,
        variantId: (data as any).variantId ?? null,
        status: 'PENDING',
        amount: amountInt,
        variantNameSnapshot: vs?.name ?? null,
        variantSkuSnapshot: vs?.sku ?? null,
        priceAtPurchase: amountInt,
        durationSnapshot: vs?.durationMonths ?? null,
        durationSnapshotUnit: vs?.durationUnit ?? null,
        accountTypeSnapshot: vs?.accountType ?? null,
        conditionsSnapshot: vs?.conditions ?? null,
        baseNameSnapshot: vs?.baseName ?? (vs?.name ?? null),
      } as any)
      .returning()

    return { ...order, id: publicId }
  },

  async transitionStatus(publicId: string, action: OrderAction) {
    const order = await this.getById(publicId)
    const targetStatus = ACTION_TO_STATUS[action]

    if (!VALID_TRANSITIONS[order.status].includes(targetStatus)) {
      throw new ConflictError(
        `Cannot ${action} order in ${order.status} status`
      )
    }

    const updateData: Record<string, any> = { status: targetStatus }
    if (targetStatus === 'PAID') {
      updateData.paidAt = new Date()
    }
    if (targetStatus === 'REFUNDED' && (order as any).vaultItemId) {
      await db
        .update(vaultItems)
        .set({ status: 'AVAILABLE', allocatedAt: null })
        .where(eq(vaultItems.id, (order as any).vaultItemId))
      updateData.vaultItemId = null
    }

    const [updated] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.publicId, publicId))
      .returning()

    return { ...updated, id: (updated as any).publicId }
  },

  // ─── Payment gateway helpers ────────────────────────────────────────────
  // Internal-id-bearing lookups used by the payments module. Kept separate
  // from getById/listByUser (which expose the public API shape) because
  // payments.service needs the internal uuid + fulfillment type for the
  // allocate_credential RPC and webhook lookups.

  // ─── Atomic PENDING -> PAID claim (webhook race guard) ────────────────────
  // Single-statement conditional update: concurrent deliveries race here, and
  // exactly one wins. Losers get null and must treat the order as
  // already-claimed (re-read for the response, never allocate). This is what
  // turns gateway at-least-once retries into behaviorally-exactly-once
  // fulfillment without threading a transaction through every caller.
  async claimPaid(publicId: string) {
    const rows = (await db.execute(sql`
      update orders set status = 'PAID', paid_at = now()
      where public_id = ${publicId} and status = 'PENDING'
      returning public_id
    `)) as unknown as any
    const claimed = Array.isArray(rows) ? rows[0] : rows?.rows?.[0]
    return claimed ? { ...claimed, id: claimed.public_id ?? publicId } : null
  },

  async getPayableDetails(publicId: string): Promise<PayableOrder> {
    const [row] = await db
      .select({
        id: orders.id,
        publicId: orders.publicId,
        userId: orders.userId,
        status: orders.status,
        amount: orders.amount,
        variantId: orders.variantId,
        paymentRef: orders.paymentRef,
        paymentProvider: orders.paymentProvider,
        fulfillmentType: productVariants.fulfillmentType,
      })
      .from(orders)
      .leftJoin(productVariants, eq(orders.variantId, productVariants.id))
      .where(eq(orders.publicId, publicId))

    if (!row) throw new NotFoundError('Order not found')
    return row as PayableOrder
  },

  async findPayableByProviderRef(providerRef: string): Promise<PayableOrder | null> {
    const [row] = await db
      .select({
        id: orders.id,
        publicId: orders.publicId,
        userId: orders.userId,
        status: orders.status,
        amount: orders.amount,
        variantId: orders.variantId,
        paymentRef: orders.paymentRef,
        paymentProvider: orders.paymentProvider,
        fulfillmentType: productVariants.fulfillmentType,
      })
      .from(orders)
      .leftJoin(productVariants, eq(orders.variantId, productVariants.id))
      // Gateways echo back OUR order id (e.g. SumoPod data.order_id), not the
      // gateway-side payment_id stored in payment_ref — match either.
      .where(or(eq(orders.paymentRef, providerRef), eq(orders.publicId, providerRef)))

    return (row as PayableOrder) ?? null
  },

  async setProviderRef(publicId: string, provider: string, providerRef: string) {
    await db
      .update(orders)
      .set({ paymentProvider: provider, paymentRef: providerRef })
      .where(eq(orders.publicId, publicId))
  },

  async setVaultItem(internalOrderId: string, vaultItemId: string) {
    await db
      .update(orders)
      .set({ vaultItemId })
      .where(eq(orders.id, internalOrderId))
  },

  async listAll(params: { status?: string; q?: string; limit?: number; offset?: number; oldest?: boolean; sort?: string; sortDir?: string } = {}) {
    const { status, q, limit = 50, offset = 0, oldest = false, sort, sortDir } = params
    const conditions = []
    // Comma-separated statuses power the combined action queue (PENDING,PAID).
    if (status) {
      const list = status.split(',').map((s) => s.trim()).filter(Boolean)
      conditions.push(list.length > 1 ? inArray(orders.status, list as any) : eq(orders.status, list[0] as any))
    }
    if (q) {
      const like = `%${q}%`
      conditions.push(
        or(
          ilike(orders.publicId, like),
          ilike(sql`${orders.userId}::text`, like),
          ilike(orders.variantNameSnapshot, like),
          ilike(orders.baseNameSnapshot, like),
          ilike(orders.paymentRef, like),
          ilike(products.name, like),
          ilike(profiles.email, like)
        )
      )
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Parallelize data + count + statusCounts (3 independent queries)
    const [rows, [{ count: total }], statusCounts] = await Promise.all([
      db
        .select({
          id: orders.publicId,
          userId: orders.userId,
          customerEmail: profiles.email,
          productId: orders.productId,
          variantId: orders.variantId,
          variantPublicId: productVariants.publicId,
          status: orders.status,
          amount: orders.amount,
          paymentRef: orders.paymentRef,
          paymentProvider: orders.paymentProvider,
          fulfillmentType: productVariants.fulfillmentType,
          createdAt: orders.createdAt,
          paidAt: orders.paidAt,
          productName: products.name,
          variantNameSnapshot: orders.variantNameSnapshot,
          baseNameSnapshot: orders.baseNameSnapshot,
        })
        .from(orders)
        .leftJoin(products, eq(orders.productId, products.id))
        .leftJoin(productVariants, eq(orders.variantId, productVariants.id))
        .leftJoin(profiles, eq(orders.userId, profiles.id))
        .where(whereClause)
        .orderBy(sort === 'amount' ? (sortDir === 'asc' ? sql`${orders.amount} asc` : desc(orders.amount))
          : sort === 'status' ? (sortDir === 'asc' ? sql`${orders.status} asc` : desc(orders.status))
          : oldest ? sql`${orders.createdAt} asc` : desc(orders.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(orders)
        .leftJoin(products, eq(orders.productId, products.id))
        .leftJoin(profiles, eq(orders.userId, profiles.id))
        .where(whereClause),
      getStatusCounts(),
    ] as any[])

    const counts: Record<string, number> = { ALL: total }
    for (const r of statusCounts) counts[r.status] = r.count

    // Batched vault availability for the page (2 queries, not N+1).
    // on_demand variants map to 9999; legacy variant-less rows get null.
    const variantIds = [...new Set(rows.map((r: any) => r.variantId).filter(Boolean))] as string[]
    const stockByVariant = await getStockCounts(variantIds)

    return {
      orders: rows.map((r: any) => ({
        ...r,
        productName: r.variantNameSnapshot ?? r.baseNameSnapshot ?? r.productName ?? 'Produk',
        fulfillmentType: r.fulfillmentType ?? 'vault',
        vaultAvailable: r.variantId ? stockByVariant.get(r.variantId) ?? 0 : null,
      })),
      total,
      counts,
    }
  },

  // ─── Flow-aware delivery (admin ticket queue) ─────────────────────────────
  // PAID -> DELIVERED with allocation:
  //  - vault: allocate_credential RPC; zero stock -> ConflictError STOK_HABIS,
  //    order stays PAID for refund-or-restock handling.
  //  - on_demand: requires a credential — encrypt-imports ONE vault row, then
  //    allocates it in the same call (no orphan stock between import/deliver).
  // Retry-safe: an already-allocated order skips straight to deliver.
  // Never logs the raw credential — audit snapshots only reference the order.
  async deliverWithCredential(publicId: string, rawCredential?: string | null) {
    const order = await this.getPayableDetails(publicId)
    if (order.status !== 'PAID') {
      throw new ConflictError(`Cannot deliver order in ${order.status} status`)
    }
    if (!order.variantId) {
      throw new ConflictError('Order has no variant linked')
    }

    const existing = await this.getById(publicId)
    if ((existing as any).vaultItemId) {
      return this.transitionStatus(publicId, 'deliver')
    }

    if ((order.fulfillmentType ?? 'vault') === 'on_demand') {
      const line = (rawCredential ?? '').trim()
      if (!line) throw new BadRequestError('Credential required for on-demand delivery')
      const aesSecret = process.env.AES_SECRET_KEY
      if (!aesSecret) throw new Error('AES_SECRET_KEY not configured')
      const key = await importKeyFromBase64(aesSecret)
      const payload = await encrypt(key, line)
      const [variant] = await db
        .select({ productId: productVariants.productId })
        .from(productVariants)
        .where(eq(productVariants.id, order.variantId))
      await db.insert(vaultItems).values({
        variantId: order.variantId,
        productId: variant?.productId ?? null,
        credentialPayload: JSON.stringify(payload),
        status: 'AVAILABLE',
      })
    }

    const allocated = await allocateCredential(order.variantId, order.id)
    if (!allocated) {
      throw new ConflictError('STOK_HABIS: no vault stock available for this variant')
    }
    await this.setVaultItem(order.id, allocated.id)
    return this.transitionStatus(publicId, 'deliver')
  },
}
