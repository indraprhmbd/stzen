// ─── Expiry math (single source of truth) ───────────────────────────────
// Anchor is paid_at: no delivered_at column exists, and PAID already
// schedules the event so DELIVERED needs nothing. Month = calendar month
// (setMonth), matching how subscriptions are sold - not 30-day blocks.
// Pure function: unit-tested, no I/O.

import type { DurationUnit } from './notify.types'

export function computeExpiry(
  paidAt: string | null | undefined,
  value: number | null | undefined,
  unit: DurationUnit | string | null | undefined,
): Date | null {
  if (!paidAt || value == null || !unit) return null
  if (!Number.isFinite(value) || value <= 0) return null
  const anchor = new Date(paidAt)
  if (Number.isNaN(anchor.getTime())) return null

  const expiry = new Date(anchor.getTime())
  switch (unit) {
    case 'day':
      expiry.setDate(expiry.getDate() + value)
      break
    case 'week':
      expiry.setDate(expiry.getDate() + value * 7)
      break
    case 'month':
      expiry.setMonth(expiry.getMonth() + value)
      break
    default:
      return null
  }
  return expiry
}
