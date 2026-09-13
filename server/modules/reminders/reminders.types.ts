// ─── Reminders types ────────────────────────────────────────────────────

import type { NotifyResult } from '../../shared/lib/notify/notify.types'

export type ReminderState = 'none' | 'scheduled'

export interface PreviewRow {
  publicId: string
  productName: string
  status: string
  paidAt: string | null
  expiry: string | null
  durationSource: 'snapshot' | 'varian' | null
  reminderState: ReminderState
  eligible: boolean
  reason: string
}

export interface BackfillResult {
  scanned: number
  scheduled: number
  skipped: number
  results: NotifyResult[]
}
