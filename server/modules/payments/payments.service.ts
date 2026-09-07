import type { Context } from 'hono'
import { ordersService } from '../orders/orders.service'
import { allocateCredential } from '../../shared/lib/db-helpers'
import { appendAudit, claimIdempotencyKey, findAuditByIdempotencyKey } from '../../shared/lib/audit'
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/http'
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
  // POST /api/v1/payments/:orderId/initiate — authed, owner-only
  async initiatePayment(orderPublicId: string, userId: string) {
    const order = await ordersService.getPayableDetails(orderPublicId)
    if (order.userId !== userId) throw new NotFoundError('Order not found')
    if (order.status !== 'PENDING') {
      throw new ConflictError(`Cannot initiate payment for a ${order.status} order`)
    }

    const providerName = getActiveProviderName()
    const provider = getProvider(providerName)
    const result = await provider.createInvoice({
      orderId: order.id,
      orderPublicId: order.publicId,
      amount: Number(order.amount),
    })

    await ordersService.setProviderRef(orderPublicId, providerName, result.providerRef)
    return { provider: providerName, checkoutUrl: result.checkoutUrl }
  },

  // GET /api/v1/payments/:orderId/status — authed, owner-only
  async getStatus(orderPublicId: string, userId: string) {
    const order = await ordersService.getById(orderPublicId, userId)
    return { status: order.status, paidAt: order.paidAt }
  },

  // POST /api/v1/webhooks/:provider — public, verified by provider.parseWebhook
  async handleWebhook(providerName: string, c: Context) {
    const provider = getProvider(providerName)
    const parsed = await provider.parseWebhook(c)

    // Event id is mandatory (providers reject deliveries without one). Claim
    // first: unique violation means retried or replayed delivery, return the
    // stored outcome instead of re-running fulfillment.
    if (!parsed.eventId) {
      throw new BadRequestError('Webhook event is missing event id')
    }
    const idempotencyKey = `webhook:${providerName}:${parsed.eventId}`
    const claimed = await claimIdempotencyKey(idempotencyKey).catch(() => null)
    if (claimed === false) {
      const prior = await findAuditByIdempotencyKey(idempotencyKey).catch(() => null)
      return prior ?? { status: 'duplicate', skipped: true }
    }

    const order = await ordersService.findPayableByProviderRef(parsed.providerRef)
    if (!order) throw new NotFoundError('Order not found for provider reference')

    // Callback amount must match what the invoice was issued for — never
    // fulfill an underpaying (or cross-wired) gateway notification. Providers
    // whose contract always carries the amount fail closed on omission.
    if (parsed.amount == null) {
      if (provider.amountRequired) {
        throw new ConflictError('Webhook callback is missing amount')
      }
    } else if (Number(parsed.amount) !== Number(order.amount)) {
      throw new ConflictError(`Amount mismatch: callback ${parsed.amount} vs order ${order.amount}`)
    }

    let result: Record<string, unknown>
    if (order.status !== 'PENDING') {
      // Already processed (retried webhook, or admin acted first). Idempotent no-op.
      result = { status: order.status, skipped: true }
    } else if (parsed.outcome === 'paid') {
      result = await this.fulfillPaidOrder(order)
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
      // Lost the race (duplicate delivery already processed) — re-read, never allocate.
      const current = await ordersService.getById(order.publicId).catch(() => null)
      return { status: current?.status ?? order.status, skipped: true }
    }
    const paid = { status: 'PAID' as const }

    if (order.fulfillmentType === 'on_demand') {
      return { status: paid.status }
    }

    if (!order.variantId) {
      // Legacy product-only order with vault fulfillment and no variant link —
      // nothing safe to auto-allocate. Leave at PAID for manual admin deliver.
      return { status: paid.status, allocated: false }
    }

    const allocated = await allocateCredential(order.variantId, order.id)
    if (!allocated) {
      // Out of stock at payment time — stays PAID, needs manual admin fulfillment.
      return { status: paid.status, allocated: false }
    }

    await ordersService.setVaultItem(order.id, allocated.id)
    const delivered = await ordersService.transitionStatus(order.publicId, 'deliver')
    return { status: delivered.status, allocated: true }
  },
}
