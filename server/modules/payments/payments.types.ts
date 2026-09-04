import type { Context } from 'hono'

// ─── Payment Provider Interface ─────────────────────────────────────────────
// Every gateway (manual, duitku, sumopod, ...) implements this shape.
// payments.service.ts picks one by PAYMENT_ACTIVE_PROVIDER env for initiating
// payments, but ALL registered providers can receive webhooks — the provider
// name in the webhook URL path decides which one parses that request.

export type PaymentOutcome = 'paid' | 'failed' | 'expired'

export interface CreateInvoiceInput {
  orderId: string // internal uuid (for provider-side metadata only)
  orderPublicId: string // short public id — used as merchantOrderId / order_id
  amount: number // IDR, integer
  customerEmail?: string | null
  description?: string
}

export interface CreateInvoiceResult {
  checkoutUrl: string | null // null for providers with no redirect (manual)
  providerRef: string // gateway's reference — stored in orders.payment_ref
}

export interface WebhookResult {
  providerRef: string // matches orders.payment_ref set at initiate time
  outcome: PaymentOutcome
  amount?: number
  eventId?: string | null // idempotency key material — dedupes retried webhooks
}

export interface PaymentProvider {
  name: string
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult>
  // Reads the raw request (raw body / form body) itself — never call
  // c.req.json() upstream, it re-serializes and breaks signature checks.
  parseWebhook(c: Context): Promise<WebhookResult>
}
