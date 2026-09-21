export interface AdminOrder {
  id: string
  productName: string
  userId: string
  customerEmail: string | null
  variantId: string | null
  variantPublicId: string | null
  amount: string
  paymentRef: string | null
  paymentProvider: string | null
  customerAccount: string
  waNumber: string
  fulfillmentType: string
  vaultAvailable: number | null
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
  refundAmount: number | null
  claimCount: number
  noteCount: number
  createdAt: string
  paidAt: string | null
}

export interface ManualVariant {
  id: string
  name: string
  price: string | number
  requiresDeliveryInfo: boolean
}

export interface RefundCalcData {
  amount: number
  status: string
  paidAt: string | null
  claimCount: number
  claims: { id: string; note: string | null; actorEmail: string | null; claimedAt: string }[]
  preview: { totalDays: number; usedDays: number; remainingDays: number; tier: string; fee: number; refund: number } | null
}

// Shared by DataTable headers (desktop) and TableSortMenu (mobile <sm).
// 7 columns: TANGGAL absorbs UMUR, PRODUK absorbs ALUR, ID absorbs REF.
export const orderColumns = [
  { label: 'ID' },
  { label: 'TANGGAL', sortKey: 'createdAt' },
  { label: 'PRODUK' },
  { label: 'PELANGGAN' },
  { label: 'JUMLAH', sortKey: 'amount' },
  { label: 'STATUS', sortKey: 'status' },
  { label: 'AKSI', className: 'text-right' },
]

// Ticket-queue tabs. `butuh-tindakan` is the combined action queue
// (PENDING,PAID oldest-first); the rest are terminal-state archives.
export const TABS = [
  { key: 'butuh-tindakan', label: 'Butuh Tindakan', statuses: 'PENDING,PAID' },
  { key: 'terkirim', label: 'Terkirim', statuses: 'DELIVERED' },
  { key: 'ditolak', label: 'Ditolak', statuses: 'REJECTED' },
  { key: 'refund', label: 'Refund', statuses: 'REFUNDED' },
  { key: 'semua', label: 'Semua', statuses: '' },
] as const

export type TabKey = (typeof TABS)[number]['key']

export function formatAge(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}j ${mins % 60}m`
  return `${Math.floor(hours / 24)}h ${hours % 24}j`
}

export const refundTierLabel: Record<string, string> = {
  under_1_week: 'Pakai < 1 minggu',
  no_claim: 'Tanpa klaim',
  claims_1_2: 'Klaim 1-2',
  claims_3: 'Klaim 3',
  claims_over_3: 'Klaim > 3',
}
