// ─── Order Types ────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'PAID' | 'DELIVERED' | 'REFUNDED' | 'REJECTED'

export type OrderAction = 'approve' | 'reject' | 'deliver' | 'refund'

export interface Order {
  id: string
  userId: string
  productId: string
  vaultItemId: string | null
  status: OrderStatus
  paymentRef: string | null
  paymentProvider: string | null
  // Buyer delivery contact (storefront checkout; '' when the variant did
  // not require delivery info). Admin-editable pre-PAID via the manual
  // review form (approve-manual), frozen after.
  customerAccount: string
  waNumber: string
  amount: string
  createdAt: string
  paidAt: string | null
  // Applied refund result (0025). NULL = never refunded / legacy full refund.
  refundAmount: number | null
}

export interface OrderWithProduct extends Order {
  productName: string
  productCategory: string
  // Duration snapshots for expiry-aware consumers (reminders module).
  // Null duration = no expiry (lifetime / non-subscription product).
  durationValue: number | null
  durationUnit: string | null
  variantSku: string | null
}

// Internal-id-bearing shape used by the payments module (webhook lookups,
// allocate_credential RPC calls). Not exposed over the public API.
export interface PayableOrder {
  id: string // internal uuid, not publicId
  publicId: string
  userId: string
  status: OrderStatus
  amount: number
  variantId: string | null
  paymentRef: string | null
  paymentProvider: string | null
  fulfillmentType: string | null
}

// ─── State Machine ──────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'REJECTED'],
  PAID: ['DELIVERED', 'REFUNDED'],
  REJECTED: [],
  // DELIVERED→REFUNDED added for the refund calculator (0025): warranty
  // claims only exist post-delivery; stock release reuses the PAID path.
  DELIVERED: ['REFUNDED'],
  REFUNDED: [],
}

export const ACTION_TO_STATUS: Record<OrderAction, OrderStatus> = {
  approve: 'PAID',
  reject: 'REJECTED',
  deliver: 'DELIVERED',
  refund: 'REFUNDED',
}
