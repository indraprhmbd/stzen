// Pure refund math (spec docs/refund-calculator2026-09-21.md).
// Refund = (price × remaining ÷ total) × fee. Rupiah floored.
// Tier: usage < 7d → 0.8 regardless of claims; else 0→0.7, 1–2→0.6,
// 3→0.5, >3→0.4. No Date.now inside: callers pass `now` (testable).

export type DurationUnit = 'day' | 'week' | 'month'

export interface RefundInputs {
  amount: number
  totalValue: number | null
  totalUnit: string | null
  paidAt: string | Date | null
  now: number
  claimCount: number
}

export interface RefundPreview {
  totalDays: number
  usedDays: number
  remainingDays: number
  tier: string
  fee: number
  refund: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export function durationToDays(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  if (unit === 'day') return value
  if (unit === 'week') return value * 7
  if (unit === 'month') return value * 30
  return null
}

export function serviceFeeTier(usedDays: number, claimCount: number): { tier: string; fee: number } {
  if (usedDays < 7) return { tier: 'under_1_week', fee: 0.8 }
  if (claimCount <= 0) return { tier: 'no_claim', fee: 0.7 }
  if (claimCount <= 2) return { tier: 'claims_1_2', fee: 0.6 }
  if (claimCount <= 3) return { tier: 'claims_3', fee: 0.5 }
  return { tier: 'claims_over_3', fee: 0.4 }
}

export function computeRefund(inputs: RefundInputs): RefundPreview | null {
  const { amount, totalValue, totalUnit, paidAt, now, claimCount } = inputs
  if (totalValue == null || !totalUnit || paidAt == null) return null
  const totalDays = durationToDays(totalValue, totalUnit)
  if (totalDays == null) return null
  const paidMs = new Date(paidAt).getTime()
  if (!Number.isFinite(paidMs)) return null
  const usedDays = Math.max(0, (now - paidMs) / DAY_MS)
  const remainingDays = Math.max(0, totalDays - usedDays)
  const { tier, fee } = serviceFeeTier(usedDays, claimCount)
  const refund = Math.floor((amount * remainingDays) / totalDays * fee)
  return { totalDays, usedDays, remainingDays, tier, fee, refund }
}
