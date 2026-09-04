import type { PaymentProvider } from '../payments.types'

// ─── SumoPod Provider (STUB) ─────────────────────────────────────────────────
// Sandbox: api-pay-sandbox.sumopod.com/api/v1 (pre-KYC). Redirect flow via
// payment_link_url (pay.sumopod.com/link/…). Grounding notes:
// docs/payments-scaffold-2026-09-04.md.
//
// Not wired yet — no sandbox API key available. Fill in the TODOs below once
// PAYMENT_SUMOPOD_API_KEY is set in server/.env. Only unofficial SDKs exist —
// this integrates directly via fetch, per repo convention (no new deps).
//
// Webhooks are Svix-style: headers `svix-id`, `svix-timestamp`, `svix-signature`,
// verified against the raw body with a `whsec_…` secret — OR a simpler static
// `whtok_…` bearer token mode. Confirm which mode the sandbox dashboard issues
// before wiring parseWebhook.

function requireConfig() {
  const apiKey = process.env.PAYMENT_SUMOPOD_API_KEY
  const baseUrl = process.env.PAYMENT_SUMOPOD_BASE_URL
  if (!apiKey || !baseUrl) {
    throw new Error(
      'SumoPod is not configured. Set PAYMENT_SUMOPOD_API_KEY, PAYMENT_SUMOPOD_BASE_URL in server/.env.'
    )
  }
  return { apiKey, baseUrl }
}

export const sumopodProvider: PaymentProvider = {
  name: 'sumopod',

  async createInvoice(_input) {
    requireConfig()
    // TODO (needs sandbox key):
    // 1. POST `${baseUrl}/payments` (confirm exact path against sandbox docs) with:
    //      Authorization: Bearer ${apiKey}
    //      { order_id: input.orderPublicId, amount: input.amount, currency: 'IDR',
    //        expires_in_hours: Math.ceil(Number(process.env.PAYMENT_DEFAULT_EXPIRY_MINUTES ?? 60) / 60),
    //        success_return_url: `${process.env.PAYMENT_APP_BASE_URL}/payment/return?order=${input.orderPublicId}`,
    //        cancel_return_url: `${process.env.PAYMENT_APP_BASE_URL}/payment/return?order=${input.orderPublicId}&cancelled=1` }
    // 2. return { checkoutUrl: json.payment_link_url, providerRef: json.id ?? json.order_id }
    throw new Error('SumoPod provider not implemented yet — see TODOs in providers/sumopod.ts')
  },

  async parseWebhook(_c) {
    const { apiKey } = requireConfig()
    const webhookSecret = process.env.PAYMENT_SUMOPOD_WEBHOOK_SECRET
    const webhookToken = process.env.PAYMENT_SUMOPOD_WEBHOOK_TOKEN
    if (!webhookSecret && !webhookToken) {
      throw new Error('SumoPod webhook not configured: set PAYMENT_SUMOPOD_WEBHOOK_SECRET or PAYMENT_SUMOPOD_WEBHOOK_TOKEN')
    }
    void apiKey
    // TODO:
    // Svix mode (whsec_…):
    //   1. const raw = await c.req.text() // read raw body ONCE, before any parseBody/json call
    //   2. const id = c.req.header('svix-id'); const ts = c.req.header('svix-timestamp')
    //   3. const signedContent = `${id}.${ts}.${raw}`
    //      verify against `svix-signature` header per Svix's HMAC-SHA256 scheme
    //      (header value is `v1,<base64 sig>[ v1,<sig2>...]` — split and check each)
    // Token mode (whtok_…):
    //   1. compare `Authorization` header (or configured header) against webhookToken directly
    // Then:
    //   const body = JSON.parse(raw)
    //   outcome: body.event === 'payment.completed' ? 'paid'
    //          : body.event === 'payment.expired' ? 'expired' : 'failed'
    //   return { providerRef: body.data.order_id, outcome, amount: body.data.amount, eventId: body.id }
    throw new Error('SumoPod webhook parsing not implemented yet — see TODOs in providers/sumopod.ts')
  },
}
