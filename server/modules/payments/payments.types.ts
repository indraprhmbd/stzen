import type { Context } from 'hono'

// ─── Payment Provider Interface ─────────────────────────────────────────────
// Every gateway (manual, duitku, sumopod, ...) implements this shape.
// payments.service.ts picks one by PAYMENT_ACTIVE_PROVIDER env for initiating
// payments, but ALL registered providers can receive webhooks - the provider
// name in the webhook URL path decides which one parses that request.

export type PaymentOutcome = 'paid' | 'failed' | 'expired'

export interface CreateInvoiceInput {
  orderId: string // internal uuid (for provider-side metadata only)
  orderPublicId: string // short public id - used as merchantOrderId / order_id
  amount: number // IDR, integer
  customerEmail?: string | null
  description?: string
}

export interface CreateInvoiceResult {
  checkoutUrl: string | null // null for providers with no redirect (manual)
  providerRef: string // gateway's reference - stored in orders.payment_ref
}

export interface WebhookResult {
  providerRef: string // matches orders.payment_ref set at initiate time
  outcome: PaymentOutcome
  amount?: number
  eventId?: string | null // idempotency key material - dedupes retried webhooks
}

export interface PaymentProvider {
  name: string
  // True when the gateway contract always carries the paid amount and the
  // handler must reject callbacks that omit it. Missing amount with
  // amountRequired silently skips the reconcile guard, so this fails closed.
  amountRequired: boolean
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult>
  // Reads the raw request (raw body / form body) itself - never call
  // c.req.json() upstream, it re-serializes and breaks signature checks.
  parseWebhook(c: Context): Promise<WebhookResult>
}

// ─── Webhook Capture Signal ─────────────────────────────────────────────────
// Thrown by a provider's parseWebhook when it has no verification credentials
// configured yet (sandbox onboarding: the gateway only issues secrets AFTER a
// successful test delivery - chicken-and-egg). webhooks.routes.ts catches this
// and answers 200 { ok: true, captured: true } so the gateway's test passes.
// NOTHING is trusted: no order lookup, no state change, payload only lands in
// server logs for shape inspection. Once the secret/token env is set, the
// provider must verify for real and never throw this.
export class WebhookCaptureError extends Error {
  raw: string
  headers: Record<string, string>

  constructor(provider: string, raw: string, headers: Record<string, string>) {
    super(`[${provider}] webhook captured (unverified - no credentials configured)`)
    this.name = 'WebhookCaptureError'
    this.raw = raw
    this.headers = headers
  }
}
