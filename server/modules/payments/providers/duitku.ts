import type { PaymentProvider } from '../payments.types'

// ─── Duitku Provider (STUB) ──────────────────────────────────────────────────
// Flavor: Pop redirect (paymentUrl). No duitku.js popup.
// Docs: docs.duitku.com/pop/en/. Grounding notes: docs/payments-scaffold-2026-09-04.md.
//
// Not wired yet — no sandbox merchant code / API key available. Fill in the
// TODOs below once PAYMENT_DUITKU_MERCHANT_CODE / PAYMENT_DUITKU_API_KEY are
// set in server/.env.
//
// ⚠️ Open blocker: Duitku's createInvoice REQUEST signature is
// MD5(merchantCode + merchantOrderId + amount + apiKey). crypto.subtle has no
// MD5. Vendor a tiny MD5 helper (keep Web Crypto purity, zero deps) before
// wiring createInvoice — do not reach for node:crypto, it breaks edge runtime
// portability. The CALLBACK signature (webhook) is HMAC-SHA256, which IS
// supported by shared/lib/hmac.ts already.

function requireConfig() {
  const merchantCode = process.env.PAYMENT_DUITKU_MERCHANT_CODE
  const apiKey = process.env.PAYMENT_DUITKU_API_KEY
  const baseUrl = process.env.PAYMENT_DUITKU_BASE_URL
  if (!merchantCode || !apiKey || !baseUrl) {
    throw new Error(
      'Duitku is not configured. Set PAYMENT_DUITKU_MERCHANT_CODE, PAYMENT_DUITKU_API_KEY, PAYMENT_DUITKU_BASE_URL in server/.env.'
    )
  }
  return { merchantCode, apiKey, baseUrl }
}

export const duitkuProvider: PaymentProvider = {
  name: 'duitku',

  async createInvoice(_input) {
    requireConfig()
    // TODO (needs sandbox keys + a vendored MD5 helper — see blocker above):
    // 1. merchantOrderId = input.orderPublicId
    // 2. signature = MD5(merchantCode + merchantOrderId + amount + apiKey)
    // 3. POST `${baseUrl}/api/merchant/createInvoice` with:
    //      { merchantCode, paymentAmount: input.amount, merchantOrderId,
    //        productDetails: input.description ?? 'Order', email: input.customerEmail,
    //        callbackUrl: `${process.env.PAYMENT_APP_BASE_URL}/api/v1/webhooks/duitku`,
    //        returnUrl: `${process.env.PAYMENT_APP_BASE_URL}/payment/return`,
    //        expiryPeriod: Number(process.env.PAYMENT_DEFAULT_EXPIRY_MINUTES ?? 60),
    //        signature }
    // 4. Amount must be >= 10.000 IDR (Duitku sandbox minimum).
    // 5. return { checkoutUrl: json.paymentUrl, providerRef: json.reference }
    throw new Error('Duitku provider not implemented yet — see TODOs in providers/duitku.ts')
  },

  async parseWebhook(_c) {
    requireConfig()
    // TODO:
    // 1. const body = await c.req.parseBody() // Duitku callback is form-encoded, NOT json
    // 2. const raw = `${body.merchantCode}${body.amount}${body.merchantOrderId}`
    //    const valid = await verifyHmacSha256Hex(apiKey, raw, String(body.signature))
    //    (confirm exact field concatenation order against sandbox docs before trusting this)
    // 3. if (!valid) throw new UnauthorizedError('Invalid Duitku signature')
    // 4. outcome: body.resultCode === '00' ? 'paid' : 'failed'
    // 5. return { providerRef: String(body.merchantOrderId), outcome,
    //             amount: Number(body.amount), eventId: String(body.reference) }
    throw new Error('Duitku webhook parsing not implemented yet — see TODOs in providers/duitku.ts')
  },
}
