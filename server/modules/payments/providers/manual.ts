import { BadRequestError } from '../../../shared/errors/http'
import type { PaymentProvider } from '../payments.types'

// ─── Manual Provider ────────────────────────────────────────────────────────
// Today's flow as a PaymentProvider: no redirect, no webhook. Admin approves
// orders by hand from the admin Orders queue (existing approve/reject/deliver
// actions). This proves the PaymentProvider interface shape and keeps the
// blind-approve path working while gateway providers are stubbed out.

export const manualProvider: PaymentProvider = {
  name: 'manual',

  async createInvoice(input) {
    // Nothing to redirect to — the order stays PENDING until an admin
    // approves it in the dashboard. providerRef mirrors the order's own
    // public id so the (unused) webhook lookup path stays well-defined.
    return { checkoutUrl: null, providerRef: input.orderPublicId }
  },

  async parseWebhook() {
    throw new BadRequestError('Manual provider does not accept webhooks')
  },
}
