import type { Context } from 'hono'
import { supabaseAdmin } from '../../shared/db'
import { ordersService } from '../orders/orders.service'
import { allocateCredential } from '../../shared/lib/db-helpers'
import { appendAudit, claimIdempotencyKey, findAuditByIdempotencyKey } from '../../shared/lib/audit'
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/http'
import { SUMOPOD_MIN_AMOUNT_IDR, isQrisAmountMatch } from '../../shared/lib/payments'
import { manualProvider } from './providers/manual'
import { duitkuProvider } from './providers/duitku'
import { sumopodProvider } from './providers/sumopod'
import type { PaymentProvider } from './payments.types'
import type { PayableOrder } from '../orders/orders.types'
import { getEnv } from '../../shared/lib/runtime-env'

// ─── Payments Service ───────────────────────────────────────────────────────
// Registry of providers + orchestration for initiating payments and handling
// webhooks. Providers are swappable via PAYMENT_ACTIVE_PROVIDER; ALL
// registered providers can still receive webhooks regardless of which one is
// "active", since a gateway can keep sending callbacks for orders it already
// issued an invoice for.

const registry: Record<string, PaymentProvider> = {
  manual: manualProvider,
  duitku: duitkuProvider,
  sumopod: sumopodProvider,
}

function getProvider(name: string): PaymentProvider {
  const provider = registry[name]
  if (!provider) throw new NotFoundError(`Unknown payment provider: ${name}`)
  return provider
}

function getActiveProviderName(): string {
  return getEnv('PAYMENT_ACTIVE_PROVIDER') || 'manual'
}

export const paymentsService = {
  // POST /api/v1/payments/:orderId/initiate - authed, owner-only
  async initiatePayment(orderPublicId: string, userId: string) {
    const order = await ordersService.getPayableDetails(orderPublicId)
    if (order.userId !== userId) throw new NotFoundError('Order not found')
    if (order.status !== 'PENDING') {
      throw new ConflictError(`Cannot initiate payment for a ${order.status} order`)
    }

    // Method lock: the rail was chosen at checkout and stored on the order.
    // Retries and dashboard BAYAR always reuse it, never the env default,
    // so a buyer cannot switch methods after committing. Legacy/admin rows
    // without a stored provider fall back to the active env provider.
    const providerName = order.paymentProvider || getActiveProviderName()
    // Second gate: createOrder enforces the floor, this covers legacy/admin
    // rows that predate it. Fail-closed on the stored order amount.
    if (providerName === 'sumopod' && Number(order.amount) < SUMOPOD_MIN_AMOUNT_IDR) {
      throw new BadRequestError('QRIS otomatis minimal Rp10.000, gunakan pesanan manual')
    }
    const provider = getProvider(providerName)
    const result = await provider.createInvoice({
      orderId: order.id,
      orderPublicId: order.publicId,
      amount: Number(order.amount),
    })

    await ordersService.setProviderRef(orderPublicId, providerName, result.providerRef)
    return { provider: providerName, checkoutUrl: result.checkoutUrl }
  },

  // GET /api/v1/payments/:orderId/status - authed, owner-only
  async getStatus(orderPublicId: string, userId: string) {
    const order = await ordersService.getById(orderPublicId, userId)
    return { status: order.status, paidAt: order.paidAt }
  },

  // POST /api/v1/webhooks/:provider - public, verified by provider.parseWebhook
  async handleWebhook(providerName: string, c: Context) {
    const provider = getProvider(providerName)
    const parsed = await provider.parseWebhook(c)

    // Event id is mandatory (providers reject deliveries without one). Order
    // lookup and amount validation run before the claim, so unknown orders
    // and mismatched callbacks never poison retries. Concurrent duplicates
    // still serialize on the claim below; losers replay the stored outcome.
    if (!parsed.eventId) {
      throw new BadRequestError('Webhook event is missing event id')
    }

    const order = await ordersService.findPayableByProviderRef(parsed.providerRef)
    if (!order) throw new NotFoundError('Order not found for provider reference')

    // Callback amount must match what the invoice was issued for - never
    // fulfill an underpaying (or cross-wired) gateway notification. Providers
    // whose contract always carries the amount fail closed on omission.
    // SumoPod dashboard is ON for buyer-pays-fee (0.7%+300): accept either
    // base or base+fee so we never 409 a legitimate QRIS callback.
    if (parsed.amount == null) {
      if (provider.amountRequired) {
        throw new ConflictError('Webhook callback is missing amount')
      }
    } else {
      const base = Number(order.amount)
      const cb = Number(parsed.amount)
      const qrisOk = providerName === 'sumopod' && isQrisAmountMatch(base, cb)
      if (cb !== base && !qrisOk) {
        throw new ConflictError(`Amount mismatch: callback ${parsed.amount} vs order ${order.amount}`)
      }
    }

    const idempotencyKey = `webhook:${providerName}:${parsed.eventId}`
    const claimed = await claimIdempotencyKey(idempotencyKey).catch(() => null)
    if (claimed === false) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      return prior ?? { status: 'duplicate', skipped: true }
    }

    const { data: orderLink, error: linkError } = await supabaseAdmin
      .from('orders')
      .select('cart_id')
      .eq('id', order.id)
      .limit(1)
    if (linkError) throw new Error(linkError.message)
    const cartId = (orderLink?.[0] as any)?.cart_id ?? null

    let result: Record<string, unknown>
    if (order.status !== 'PENDING') {
      // Already processed (retried webhook, or admin acted first). Idempotent no-op.
      result = { status: order.status, skipped: true }
    } else if (parsed.outcome === 'paid') {
      result = cartId ? await this.fulfillCartPaidOrder(order) : await this.fulfillPaidOrder(order)
    } else if (cartId) {
      await this.releaseCartReservation(order, cartId, parsed.outcome)
      try {
        const updated = await ordersService.transitionStatus(order.publicId, 'reject')
        result = { status: updated.status }
      } catch (e) {
        if (e instanceof ConflictError) {
          result = { status: 'REJECTED', skipped: true }
        } else {
          throw e
        }
      }
    } else {
      const updated = await ordersService.transitionStatus(order.publicId, 'reject')
      result = { status: updated.status }
    }

    await appendAudit({
      action: 'order:approve',
      resourceType: 'order',
      resourcePublicId: order.publicId,
      resourceName: order.publicId,
      snapshotText: `Webhook ${providerName} outcome=${parsed.outcome} order=${order.publicId} at ${new Date().toLocaleString('id-ID')}`,
      actorEmail: `webhook:${providerName}`,
      actorType: 'system',
      diff: result,
      idempotencyKey: idempotencyKey ?? undefined,
    }).catch((e) => console.error('[audit] webhook failed', e))

    return result
  },

  // PENDING -> PAID via atomic claim (exactly one concurrent delivery wins),
  // then branch on fulfillment type:
  //  - vault: allocate_credential RPC -> PAID -> DELIVERED, credentials viewable immediately
  //  - on_demand: stop at PAID, admin ingests + delivers manually (existing admin actions)
  async fulfillPaidOrder(order: PayableOrder): Promise<Record<string, unknown>> {
    const claimed = await ordersService.claimPaid(order.publicId)
    if (!claimed) {
      // Lost the race (duplicate delivery already processed) - re-read, never allocate.
      const current = await ordersService.getById(order.publicId).catch(() => null)
      return { status: current?.status ?? order.status, skipped: true }
    }
    const paid = { status: 'PAID' as const }

    if (order.fulfillmentType === 'on_demand') {
      return { status: paid.status }
    }

    if (!order.variantId) {
      // Legacy product-only order with vault fulfillment and no variant link -
      // nothing safe to auto-allocate. Leave at PAID for manual admin deliver.
      return { status: paid.status, allocated: false }
    }

    const allocated = await allocateCredential(order.variantId, order.id)
    if (!allocated) {
      // Out of stock at payment time - stays PAID, needs manual admin fulfillment.
      return { status: paid.status, allocated: false }
    }

    await ordersService.setVaultItem(order.id, allocated.id)
    const delivered = await ordersService.transitionStatus(order.publicId, 'deliver')
    return { status: delivered.status, allocated: true }
  },

  async fulfillCartPaidOrder(order: PayableOrder): Promise<Record<string, unknown>> {
    const claimed = await ordersService.claimPaid(order.publicId)
    if (!claimed) {
      const current = await ordersService.getById(order.publicId).catch(() => null)
      return { status: current?.status ?? order.status, skipped: true }
    }

    const { data: units, error: unitsError } = await supabaseAdmin
      .from('order_units')
      .select('id,status,vault_item_id')
      .eq('order_id', order.id)
      .order('position')
    if (unitsError) throw new Error(unitsError.message)
    if (!units || units.length === 0) throw new Error('Cart order has no units')

    let delivered = 0
    for (const unit of units) {
      if (unit.status !== 'RESERVED' || !unit.vault_item_id) continue
      const { error: vaultError } = await supabaseAdmin
        .from('vault_items')
        .update({
          status: 'SOLD',
          allocated_at: new Date().toISOString(),
          reserved_order_unit_id: null,
          reserved_at: null,
          reservation_expires_at: null,
        })
        .eq('id', unit.vault_item_id)
        .eq('status', 'RESERVED')
      if (vaultError) throw new Error(vaultError.message)
      const { error: unitError } = await supabaseAdmin
        .from('order_units')
        .update({ status: 'DELIVERED', delivered_at: new Date().toISOString() })
        .eq('id', unit.id)
        .eq('status', 'RESERVED')
      if (unitError) throw new Error(unitError.message)
      delivered += 1
    }

    const { data: awaitingUnits, error: awaitingError } = await supabaseAdmin
      .from('order_units')
      .select('id')
      .eq('order_id', order.id)
      .eq('status', 'AWAITING_STOCK')
    if (awaitingError) throw new Error(awaitingError.message)
    const awaiting = awaitingUnits?.length ?? 0
    const fulfillment =
      delivered === units.length && awaiting === 0
        ? 'COMPLETE'
        : delivered > 0
          ? 'PARTIAL'
          : 'NOT_STARTED'

    const { error: axesError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'PAID', fulfillment_status: fulfillment })
      .eq('id', order.id)
    if (axesError) throw new Error(axesError.message)

    let status = 'PAID'
    if (fulfillment === 'COMPLETE') {
      const deliveredOrder = await ordersService.transitionStatus(order.publicId, 'deliver')
      status = deliveredOrder.status
    }
    return { status, allocated: delivered, awaiting, total: units.length }
  },

  async releaseCartReservation(
    order: PayableOrder,
    cartId: string,
    outcome: 'failed' | 'expired'
  ): Promise<Record<string, unknown>> {
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('order_units')
      .select('id,vault_item_id')
      .eq('order_id', order.id)
      .eq('status', 'RESERVED')
    if (unitsError) throw new Error(unitsError.message)

    for (const unit of units ?? []) {
      if (!unit.vault_item_id) continue
      const { error: vaultError } = await supabaseAdmin
        .from('vault_items')
        .update({
          status: 'AVAILABLE',
          allocated_at: null,
          reserved_order_unit_id: null,
          reserved_at: null,
          reservation_expires_at: null,
        })
        .eq('id', unit.vault_item_id)
        .eq('status', 'RESERVED')
        .eq('reserved_order_unit_id', unit.id)
      if (vaultError) throw new Error(vaultError.message)
      const { error: unitError } = await supabaseAdmin
        .from('order_units')
        .update({ status: 'PENDING_PAYMENT', vault_item_id: null, delivered_at: null })
        .eq('id', unit.id)
        .eq('status', 'RESERVED')
      if (unitError) throw new Error(unitError.message)
    }

    const { error: axesError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: outcome === 'expired' ? 'EXPIRED' : 'FAILED' })
      .eq('id', order.id)
      .eq('payment_status', 'PENDING')
    if (axesError) throw new Error(axesError.message)

    const { error: cartError } = await supabaseAdmin
      .from('carts')
      .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
      .eq('id', cartId)
      .eq('status', 'CHECKOUT_PENDING')
    if (cartError) throw new Error(cartError.message)

    return { released: units?.length ?? 0 }
  },
}
