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
  amount: string
  createdAt: Date
  paidAt: Date | null
}

export interface OrderWithProduct extends Order {
  productName: string
  productCategory: string
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
  DELIVERED: [],
  REFUNDED: [],
}

export const ACTION_TO_STATUS: Record<OrderAction, OrderStatus> = {
  approve: 'PAID',
  reject: 'REJECTED',
  deliver: 'DELIVERED',
  refund: 'REFUNDED',
}
