// ─── Danger Zone constants ──────────────────────────────────────────────────
// Tiered destructive ops for admin/settings. Thresholds live here so policy
// tweaks never touch query logic. All values conservative by default.

export const DANGER = {
  // Tier 1: PENDING orders older than this are considered abandoned.
  staleOrderDaysDefault: 7,
  staleOrderDaysMin: 1,
  staleOrderDaysMax: 90,
  staleConfirmPhrase: 'TOLAK',
  // Orders are never purgeable (UU KUP 10-year retention), so only the
  // vault threshold remains.
  purgeVaultDays: 180,
  // Export token TTL: operator must complete export->purge in one sitting.
  exportTtlMs: 15 * 60 * 1000,
  purgeConfirmPhrase: 'HAPUS PERMANEN',
  // Batch deletes so the pooler never holds a giant write txn.
  purgeBatchSize: 500,
} as const

export type PurgeKind = 'orders' | 'vault'

export interface ExportFilter {
  kind: PurgeKind
  cutoff: string
}
