import type { PaymentProvider, WebhookResult } from '../payments.types'
import { WebhookCaptureError, WebhookTestPingError } from '../payments.types'
import { ForbiddenError, BadRequestError, ConflictError } from '../../../shared/errors/http'
import { verifySvixSignature, verifyWebhookToken } from '../../../shared/lib/hmac'
import { getEnv } from '../../../shared/lib/runtime-env'

// ─── SumoPod Provider ────────────────────────────────────────────────────────
// Sandbox: api-pay-sandbox.sumopod.com/api/v1 (pre-KYC, QRIS-only). Redirect
// flow via payment_link_url (pay.sumopod.com/link/…). Direct fetch integration,
// no SDK deps per repo convention. Verified against the live sandbox test
// delivery 2026-09-04 (see captured shape below) + sumopod-pay SDK source.
//
// Auth: `X-Api-Key` header (NOT Bearer).
// Webhook: Svix-style (`svix-id/timestamp/signature` + `whsec_…`) OR static
// token (`x-webhook-token` header + `whtok_…`). Sandbox test deliveries carry
// BOTH - signature wins when the secret is configured, token is the fallback.
// Events arrive as `{ event_type, data }`, e.g.:
//   {"data":{"message":"This is a test webhook from SumoPod", ...},
//    "event_type":"payment.test"}

const CREATE_TIMEOUT_MS = 30_000

function requireConfig() {
  const apiKey = getEnv('PAYMENT_SUMOPOD_API_KEY')
  const baseUrl = (getEnv('PAYMENT_SUMOPOD_BASE_URL') || 'https://api-pay-sandbox.sumopod.com/api/v1').replace(/\/+$/, '')
  if (!apiKey) {
    throw new Error(
      'SumoPod is not configured. Set PAYMENT_SUMOPOD_API_KEY in server/.env.'
    )
  }
  if (!baseUrl.startsWith('https://')) {
    throw new Error('PAYMENT_SUMOPOD_BASE_URL must use https://.')
  }
  return { apiKey, baseUrl }
}

async function postJson(url: string, apiKey: string, body: unknown): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text().catch(() => '')
    let parsed: any = null
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = null }
    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === 'object' && (parsed.message || parsed.error)) ||
        `SumoPod request failed with status ${res.status}`
      // Re-initiate on an already-invoiced order: SumoPod keeps the first
      // invoice alive under our order_id. Don't mint duplicates - tell the
      // buyer to finish the existing payment (dashboard BAYAR reuses it once
      // we persist checkoutUrl; until then this 409 is the guardrail).
      if (res.status === 409 || /already exists/i.test(String(msg))) {
        throw new ConflictError('Invoice sudah dibuat untuk order ini, selesaikan pembayaran sebelumnya.')
      }
      // Gateway client errors (bad amount, bad method code, …) are the
      // caller's problem - surface as 400 with the gateway message, not a 500.
      if (res.status >= 400 && res.status < 500) {
        throw new BadRequestError(`SumoPod: ${msg}`)
      }
      throw new Error(`SumoPod createPayment: ${msg}`)
    }
    return parsed
  } finally {
    clearTimeout(timer)
  }
}

const OUTCOME: Record<string, WebhookResult['outcome']> = {
  'payment.completed': 'paid',
  'payment.expired': 'expired',
  'payment.failed': 'failed',
}

export const sumopodProvider: PaymentProvider = {
  name: 'sumopod',
  // Sandbox and production deliveries carry data.amount. A callback without
  // it cannot be reconciled against the order, so the handler rejects.
  amountRequired: true,

  async createInvoice(input) {
    const { apiKey, baseUrl } = requireConfig()
    // Gateway constraint: order_id must match ^[A-Za-z0-9-_]+$ (max 64).
    // Our publicIds are 12-char base64url - always compliant, guard anyway.
    if (!/^[A-Za-z0-9-_]{1,64}$/.test(input.orderPublicId)) {
      throw new BadRequestError('Order id is not SumoPod-compatible')
    }
    const expiryMinutes = Number(getEnv('PAYMENT_DEFAULT_EXPIRY_MINUTES') || 60)
    const appBase = (getEnv('PAYMENT_APP_BASE_URL') || '').replace(/\/+$/, '')
    const json = await postJson(`${baseUrl}/payments`, apiKey, {
      order_id: input.orderPublicId,
      amount: input.amount,
      currency: 'IDR',
      // Sandbox rejects ambiguous invoices when the merchant has several
      // methods active - pin one (QRIS). Overridable per deploy if needed.
      payment_method_type_code: getEnv('PAYMENT_SUMOPOD_METHOD_CODE') || 'QRIS',
      expires_in_hours: Math.max(1, Math.ceil(expiryMinutes / 60)),
      ...(appBase.startsWith('https://')
        ? {
            success_return_url: `${appBase}/payment/return?order=${input.orderPublicId}`,
            cancel_return_url: `${appBase}/payment/return?order=${input.orderPublicId}&cancelled=1`,
          }
        : {}),
    })
    if (!json?.payment_link_url || !json?.payment_id) {
      throw new Error('SumoPod createPayment: unexpected response shape (missing payment_link_url/payment_id)')
    }
    return { checkoutUrl: json.payment_link_url, providerRef: json.payment_id }
  },

  async parseWebhook(c) {
    const webhookSecret = getEnv('PAYMENT_SUMOPOD_WEBHOOK_SECRET') || ''
    const webhookToken = getEnv('PAYMENT_SUMOPOD_WEBHOOK_TOKEN') || ''
    const raw = await c.req.text()

    // Sandbox onboarding: explicit flag, or no credentials at all - capture
    // the test delivery for shape inspection, answer 200, trust nothing.
    // Any configured value (even a placeholder) disables auto-capture.
    if (getEnv('PAYMENT_SUMOPOD_CAPTURE') === '1' || (!webhookSecret && !webhookToken)) {
      const headers: Record<string, string> = {}
      c.req.raw.headers.forEach((v, k) => { headers[k] = v })
      throw new WebhookCaptureError('sumopod', raw, headers)
    }

    // Signature mode first (strongest), token mode as fallback.
    const sigOk = webhookSecret
      ? await verifySvixSignature({
          secret: webhookSecret,
          rawBody: raw,
          id: c.req.header('svix-id'),
          timestamp: c.req.header('svix-timestamp'),
          signatureHeader: c.req.header('svix-signature'),
        })
      : false
    const tokenOk = !sigOk && webhookToken
      ? verifyWebhookToken(c.req.header('x-webhook-token'), webhookToken)
      : false
    if (!sigOk && !tokenOk) {
      throw new ForbiddenError('Invalid SumoPod webhook signature')
    }

    let body: any = null
    try { body = raw ? JSON.parse(raw) : null } catch {
      throw new BadRequestError('SumoPod webhook body is not valid JSON')
    }
    const eventType: string | undefined = body?.event_type
    // Dashboard connectivity ping: verified above, carries no order.
    // Answered 200 no-op by webhooks.routes.ts.
    if (eventType === 'payment.test') {
      throw new WebhookTestPingError('sumopod', eventType)
    }
    const outcome = eventType ? OUTCOME[eventType] : undefined
    if (!outcome) {
      // Test pings and future unknown events: acknowledge nothing to process.
      throw new BadRequestError(`Unsupported SumoPod event: ${eventType ?? '(missing event_type)'}`)
    }
    const providerRef: string | undefined = body?.data?.order_id
    if (!providerRef) {
      throw new BadRequestError('SumoPod webhook is missing data.order_id')
    }
    // Event id is the only replay guard in static-token mode (no signed
    // timestamp there). Require it in every mode so the handler dedup path
    // can never be skipped with a null key.
    const eventId: string | null = body?.id ?? c.req.header('svix-id') ?? null
    if (!eventId) {
      throw new BadRequestError('SumoPod webhook is missing event id')
    }
    return {
      providerRef,
      outcome,
      amount: typeof body?.data?.amount === 'number' ? body.data.amount : undefined,
      eventId,
    }
  },
}
