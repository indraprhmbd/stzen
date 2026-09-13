// ─── Reminders types ────────────────────────────────────────────────────

import type { NotifyResult } from '../../shared/lib/notify/notify.types'

export interface PreviewRow {
  publicId: string
  productName: string
  status: string
  paidAt: string | null
  expiry: string | null
  eligible: boolean
  reason: string
}

export interface BackfillResult {
  scanned: number
  scheduled: number
  skipped: number
  results: NotifyResult[]
}
