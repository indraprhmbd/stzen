// ─── Notify port ────────────────────────────────────────────────────────
// Provider-agnostic contract for order reminders. Feature modules emit
// ReminderEvents through the dispatcher; adapters (gcal today, WhatsApp
// tomorrow) implement NotificationProvider and register in app.ts.
// Adding a channel = one file + one registerProvider line. Nothing in
// orders/checkout/payments changes.

export type ReminderEvent = 'order.paid' | 'order.cancelled'

export type DurationUnit = 'day' | 'week' | 'month'

export interface OrderReminderFacts {
  publicId: string
  productName: string
  variantName?: string | null
  amount: string | number
  paidAt: string | null
  durationValue: number | null
  durationUnit: DurationUnit | string | null
  customerEmail?: string | null
}

export interface NotifyResult {
  provider: string
  event: ReminderEvent
  ok: boolean
  externalId?: string
  error?: string
}

export interface NotificationProvider {
  /** Stable id, e.g. 'gcal'. Used in settings csv + audit + results. */
  name: string
  /** False when not configured (missing secrets/settings) -> skipped. */
  isEnabled(): Promise<boolean>
  /** Create/update the expiry reminder. Idempotent per order. */
  schedule(facts: OrderReminderFacts, expiry: Date): Promise<NotifyResult>
  /** Retract the reminder (refund/reject). Missing remote item = ok. */
  cancel(orderPublicId: string): Promise<NotifyResult>
}
