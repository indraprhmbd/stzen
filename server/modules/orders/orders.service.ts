import { supabaseAdmin } from '../../shared/db'
import { getEnv } from '../../shared/lib/runtime-env'
import type { PayableOrder, OrderWithProduct, OrderAction } from './orders.types'
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/http'
import { generatePublicId } from '../../shared/lib/publicId'
import { allocateCredential, getStockCounts } from '../../shared/lib/db-helpers'
import { importKeyFromBase64, encrypt } from '../../shared/lib/crypto'
import { dispatchReminder } from '../../shared/lib/notify/notify.dispatcher'
import { auditDispatchResults } from '../../shared/lib/notify/notify.audit'
import type { OrderReminderFacts, ReminderEvent } from '../../shared/lib/notify/notify.types'
import {
  VALID_TRANSITIONS,
  ACTION_TO_STATUS,
} from './orders.types'

const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'
const VAULT_ITEMS = 'vault_items'
const ORDERS = 'orders'
const PROFILES = 'profiles'

function mapOrderRow(r: any): OrderWithProduct {
  const createdAt = r.created_at ? new Date(r.created_at) : new Date()
  const paidAt = r.paid_at ? new Date(r.paid_at) : null
  const product = Array.isArray(r.products) ? r.products[0] : (r.products || {})
  return {
    id: r.public_id,
    userId: r.user_id,
    productId: r.product_id,
    vaultItemId: r.vault_item_id,
    status: r.status,
    paymentRef: r.payment_ref,
    paymentProvider: r.payment_provider,
    amount: String(r.amount),
    createdAt: createdAt.toISOString(),
    paidAt: paidAt ? paidAt.toISOString() : null,
    productName: r.variant_name_snapshot ?? r.base_name_snapshot ?? product?.name ?? 'Produk',
    productCategory: product?.category ?? '',
    durationValue: r.duration_snapshot ?? null,
    durationUnit: r.duration_snapshot_unit ?? null,
    variantSku: r.variant_sku_snapshot ?? null,
  }
}

// Reminder fan-out after a committed state change. Shared dispatcher only:
// orders never imports a provider or the reminders module (import rule 1).
// Awaited with provider-side 5s timeouts; failures audit, never roll back
// the transition. No-duration orders resolve to no expiry and are skipped.
async function emitReminder(event: ReminderEvent, order: OrderWithProduct) {
  const facts: OrderReminderFacts = {
    publicId: order.id,
    productName: order.productName,
    variantName: order.variantSku,
    amount: order.amount,
    paidAt: order.paidAt,
    durationValue: order.durationValue,
    durationUnit: order.durationUnit,
  }
  const results = await dispatchReminder(event, facts)
  await auditDispatchResults(event, order.id, results)
}

// 30s cache for statusCounts - runs full GROUP BY on orders table.
let statusCountsCache: { data: any[]; ts: number } | null = null
async function getStatusCounts(): Promise<any[]> {
  if (statusCountsCache && Date.now() - statusCountsCache.ts < 30_000) return statusCountsCache.data

  const { data: rows, error } = await supabaseAdmin
    .from(ORDERS)
    .select('status', { count: 'exact', head: false })

  if (error) throw new Error(error.message)

  const counts: Record<string, number> = {}
  for (const row of rows || []) {
    counts[row.status] = (counts[row.status] || 0) + 1
  }

  const result = Object.entries(counts).map(([status, count]) => ({ status, count }))
  statusCountsCache = { data: result, ts: Date.now() }
  return result
}

export const ordersService = {
  async listByUser(
    userId: string,
    params: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<{ orders: OrderWithProduct[]; total: number; counts: Record<string, number> }> {
    const { status, limit = 8, offset = 0 } = params
    const statuses = ['PENDING', 'PAID', 'DELIVERED', 'REJECTED', 'REFUNDED'] as const

    let query = supabaseAdmin
      .from(ORDERS)
      .select(
        `
        *,
        ${PRODUCTS} (
          name,
          category
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const [page, ...counts] = await Promise.all([
      query.range(offset, offset + limit - 1),
      supabaseAdmin.from(ORDERS).select('*', { count: 'exact', head: true }).eq('user_id', userId),
      ...statuses.map((s) =>
        supabaseAdmin.from(ORDERS).select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', s)
      ),
    ])

    if (page.error) throw new Error(page.error.message)

    const total = status
      ? (counts[statuses.indexOf(status as (typeof statuses)[number]) + 1]?.count ?? 0)
      : (counts[0]?.count ?? 0)

    return {
      orders: (page.data || []).map(mapOrderRow),
      total,
      counts: {
        ALL: counts[0]?.count ?? 0,
        PENDING: counts[1]?.count ?? 0,
        PAID: counts[2]?.count ?? 0,
        DELIVERED: counts[3]?.count ?? 0,
        REJECTED: counts[4]?.count ?? 0,
        REFUNDED: counts[5]?.count ?? 0,
      },
    }
  },

  async getById(publicId: string, userId?: string): Promise<OrderWithProduct> {
    const { data: rows, error } = await supabaseAdmin
      .from(ORDERS)
      .select(`
        *,
        ${PRODUCTS} (
          name,
          category
        )
      `)
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) throw new NotFoundError('Order not found')

    const order = rows[0] as any

    if (userId && order.user_id !== userId) {
      throw new NotFoundError('Order not found')
    }

    return mapOrderRow(order)
  },

  async deleteOwnOrder(publicId: string, userId: string) {
    // Conditional delete: a webhook claimPaid landing between the checks and
    // the delete must not orphan a paid order. No row returned means the
    // order moved out from under us - report conflict, never silently drop.
    const { data: deleted, error } = await supabaseAdmin
      .from(ORDERS)
      .delete()
      .eq('public_id', publicId)
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .is('payment_ref', null)
      .select('public_id')

    if (error) throw new Error(error.message)
    if (!deleted || deleted.length === 0) {
      throw new ConflictError('Order no longer cancellable')
    }
    return { ok: true }
  },

  async create(data: { userId: string; productId?: string | null; variantId?: string; amount: string | number; variantSnapshot?: any }) {
    const publicId = generatePublicId()
    const amountInt = typeof data.amount === 'string' ? parseInt(data.amount, 10) : data.amount
    const vs: any = data.variantSnapshot

    const { data: order, error } = await supabaseAdmin
      .from(ORDERS)
      .insert({
        public_id: publicId,
        user_id: data.userId,
        product_id: data.productId ?? null,
        variant_id: (data as any).variantId ?? null,
        status: 'PENDING',
        amount: amountInt,
        variant_name_snapshot: vs?.name ?? null,
        variant_sku_snapshot: vs?.sku ?? null,
        price_at_purchase: amountInt,
        duration_snapshot: vs?.duration_months ?? null,
        duration_snapshot_unit: vs?.duration_unit ?? null,
        account_type_snapshot: vs?.account_type ?? null,
        conditions_snapshot: vs?.conditions ?? null,
        base_name_snapshot: vs?.base_name ?? (vs?.name ?? null),
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapOrderRow(order)
  },

  async transitionStatus(publicId: string, action: OrderAction) {
    const order = await this.getById(publicId)
    const targetStatus = ACTION_TO_STATUS[action]

    if (!VALID_TRANSITIONS[order.status].includes(targetStatus)) {
      throw new ConflictError(`Cannot ${action} order in ${order.status} status`)
    }

    const updateData: Record<string, any> = { status: targetStatus }
    if (targetStatus === 'PAID') {
      updateData.paid_at = new Date().toISOString()
    }
    if (targetStatus === 'REFUNDED' && (order as any).vault_item_id) {
      await supabaseAdmin
        .from(VAULT_ITEMS)
        .update({ status: 'AVAILABLE', allocated_at: null })
        .eq('id', (order as any).vault_item_id)
      updateData.vault_item_id = null
    }

    const { data: updated, error } = await supabaseAdmin
      .from(ORDERS)
      .update(updateData)
      .eq('public_id', publicId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    const mapped = mapOrderRow(updated)
    if (targetStatus === 'PAID') await emitReminder('order.paid', mapped)
    if (targetStatus === 'REFUNDED' || targetStatus === 'REJECTED') {
      await emitReminder('order.cancelled', mapped)
    }
    return mapped
  },

  async claimPaid(publicId: string) {
    const { data: updated, error } = await supabaseAdmin
      .from(ORDERS)
      .update({ status: 'PAID', paid_at: new Date().toISOString() })
      .eq('public_id', publicId)
      .eq('status', 'PENDING')
      .select('public_id')
      .single()

    if (error || !updated) return null
    // Webhook paid path bypasses transitionStatus: emit here (one extra
    // read; conditional update above guarantees PAID happened once).
    const order = await this.getById(updated.public_id ?? publicId)
    await emitReminder('order.paid', order)
    return { id: updated.public_id ?? publicId }
  },

  async getPayableDetails(publicId: string): Promise<PayableOrder> {
    const { data: rows, error } = await supabaseAdmin
      .from(ORDERS)
      .select(`
        id,
        public_id,
        user_id,
        status,
        amount,
        variant_id,
        payment_ref,
        payment_provider
      `)
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) throw new NotFoundError('Order not found')

    const row = rows[0] as any

    let fulfillmentType = 'vault'
    if (row.variant_id) {
      const { data: variant } = await supabaseAdmin
        .from(PRODUCT_VARIANTS)
        .select('fulfillment_type')
        .eq('id', row.variant_id)
        .limit(1)
      if (variant && variant.length > 0) {
        fulfillmentType = variant[0].fulfillment_type
      }
    }

    return {
      id: row.id,
      publicId: row.public_id,
      userId: row.user_id,
      status: row.status,
      amount: row.amount,
      variantId: row.variant_id,
      paymentRef: row.payment_ref,
      paymentProvider: row.payment_provider,
      fulfillmentType,
    }
  },

  async findPayableByProviderRef(providerRef: string): Promise<PayableOrder | null> {
    const { data: rows, error } = await supabaseAdmin
      .from(ORDERS)
      .select(`
        id,
        public_id,
        user_id,
        status,
        amount,
        variant_id,
        payment_ref,
        payment_provider
      `)
      .or(`payment_ref.eq.${providerRef},public_id.eq.${providerRef}`)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) return null

    const row = rows[0] as any

    let fulfillmentType = 'vault'
    if (row.variant_id) {
      const { data: variant } = await supabaseAdmin
        .from(PRODUCT_VARIANTS)
        .select('fulfillment_type')
        .eq('id', row.variant_id)
        .limit(1)
      if (variant && variant.length > 0) {
        fulfillmentType = variant[0].fulfillment_type
      }
    }

    return {
      id: row.id,
      publicId: row.public_id,
      userId: row.user_id,
      status: row.status,
      amount: row.amount,
      variantId: row.variant_id,
      paymentRef: row.payment_ref,
      paymentProvider: row.payment_provider,
      fulfillmentType,
    }
  },

  async setProviderRef(publicId: string, provider: string, providerRef: string) {
    const { error } = await supabaseAdmin
      .from(ORDERS)
      .update({ payment_provider: provider, payment_ref: providerRef })
      .eq('public_id', publicId)

    if (error) throw new Error(error.message)
  },

  async setVaultItem(orderId: string, vaultItemId: string) {
    const { error } = await supabaseAdmin
      .from(ORDERS)
      .update({ vault_item_id: vaultItemId })
      .eq('id', orderId)

    if (error) throw new Error(error.message)
  },

  async listAll(params: { status?: string; q?: string; limit?: number; offset?: number; oldest?: boolean; sort?: string; sortDir?: string } = {}) {
    const { status, q, limit = 50, offset = 0, oldest = false, sort, sortDir } = params

    let query = supabaseAdmin
      .from(ORDERS)
      .select(`
        *,
        ${PRODUCTS} (
          name
        ),
        ${PRODUCT_VARIANTS} (
          public_id,
          fulfillment_type
        ),
        ${PROFILES} (
          email
        )
      `)

    if (status) {
      const list = status.split(',').map((s) => s.trim()).filter(Boolean)
      if (list.length === 1) {
        query = query.eq('status', list[0])
      } else {
        query = query.in('status', list)
      }
    }

    if (q) {
      const raw = q.replace(/[%_]/g, (c) => `\\${c}`)
      const like = `%${raw}%`
      const orFilter = `public_id.ilike.${like},variant_name_snapshot.ilike.${like},base_name_snapshot.ilike.${like},payment_ref.ilike.${like}`
      query = query.or(orFilter)
    }

    // Sort in SQL before .range(): sorting the fetched page in memory
    // would order rows within the page only, breaking global order
    // across pages. Unknown keys fall back to newest-first.
    const SORT_COLUMNS: Record<string, string> = { amount: 'amount', status: 'status', createdAt: 'created_at' }
    if (sort && SORT_COLUMNS[sort]) {
      query = query.order(SORT_COLUMNS[sort], { ascending: sortDir === 'asc' })
    } else if (oldest) {
      query = query.order('created_at', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const [{ data: rows, error }, { count: total }] = await Promise.all([
      query.range(offset, offset + limit - 1),
      (async () => {
        // estimated: exact up to Supabase db-max-rows, then planner stats.
        // Pager total must not become a growing full-table COUNT scan.
        let countQuery = supabaseAdmin.from(ORDERS).select('*', { count: 'estimated', head: true })
        if (status) {
          const list = status.split(',').map((s) => s.trim()).filter(Boolean)
          if (list.length === 1) {
            countQuery = countQuery.eq('status', list[0])
          } else {
            countQuery = countQuery.in('status', list)
          }
        }
        if (q) {
          const raw = q.replace(/[%_]/g, (c) => `\\${c}`)
          const like = `%${raw}%`
          const orFilter = `public_id.ilike.${like},variant_name_snapshot.ilike.${like},base_name_snapshot.ilike.${like},payment_ref.ilike.${like}`
          countQuery = countQuery.or(orFilter)
        }
        return countQuery
      })(),
    ])

    if (error) throw new Error(error.message)

    // Rows arrive globally ordered from SQL (.order() above runs before
    // .range(), so every page continues the same order).
    const paginated = rows || []

    const statusCounts = await getStatusCounts()
    const counts: Record<string, number> = { ALL: total || 0 }
    for (const r of statusCounts) {
      counts[r.status] = r.count
    }

    // Batched vault availability for the page
    const variantIds = [...new Set(paginated.map((r: any) => r.variant_id).filter(Boolean))] as string[]
    const stockByVariant = await getStockCounts(variantIds)

    return {
      orders: paginated.map((r: any) => {
        const productVariant = Array.isArray(r.product_variants) ? r.product_variants[0] : (r.product_variants || {})
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : (r.profiles || {})
        return {
          ...mapOrderRow(r),
          fulfillmentType: productVariant?.fulfillment_type ?? 'vault',
          variantPublicId: productVariant?.public_id ?? null,
          customerEmail: profile?.email ?? null,
          vaultAvailable: r.variant_id ? stockByVariant.get(r.variant_id) ?? 0 : null,
        }
      }),
      total: total || 0,
      counts,
    }
  },

  async deliverWithCredential(publicId: string, rawCredential?: string | null) {
    const order = await this.getPayableDetails(publicId)
    console.error('[deliverWithCredential] order', { publicId, order })

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

    let allocated: { id: string; variantId: string | null; productId: string | null } | null = null

    if ((order.fulfillmentType ?? 'vault') === 'on_demand') {
      const line = (rawCredential ?? '').trim()
      if (!line) throw new BadRequestError('Credential required for on-demand delivery')
      const aesSecret = getEnv('AES_SECRET_KEY')
      if (!aesSecret) throw new Error('AES_SECRET_KEY not configured')
      const key = await importKeyFromBase64(aesSecret)
      const payload = await encrypt(key, line)

      const { data: variant, error: variantError } = await supabaseAdmin
        .from(PRODUCT_VARIANTS)
        .select('product_id')
        .eq('id', order.variantId)
        .single()

      if (variantError) throw new Error(variantError.message)

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from(VAULT_ITEMS)
        .insert({
          variant_id: order.variantId,
          product_id: variant?.product_id ?? null,
          credential_payload: JSON.stringify(payload),
          status: 'SOLD',
        })
        .select('id')
        .single()

      if (insertError) throw new Error(insertError.message)

      allocated = { id: inserted.id, variantId: order.variantId, productId: variant?.product_id ?? null }
    } else {
      console.error('[deliverWithCredential] calling allocateCredential', { variantId: order.variantId, orderId: order.id })
      allocated = await allocateCredential(order.variantId, order.id)
      console.error('[deliverWithCredential] allocateCredential result', { variantId: order.variantId, orderId: order.id, allocated })
      if (!allocated) {
        throw new ConflictError(`STOK_HABIS: no vault stock available for variant ${order.variantId}`)
      }
    }

    await this.setVaultItem(order.id, allocated.id)
    return this.transitionStatus(publicId, 'deliver')
  },
}
