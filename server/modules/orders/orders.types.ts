// ─── Order Types ────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'PAID' | 'DELIVERED' | 'REFUNDED' | 'REJECTED'

export type OrderAction = 'approve' | 'reject' | 'deliver'

export interface Order {
  id: string
  userId: string
  productId: string
  vaultItemId: string | null
  status: OrderStatus
  paymentRef: string | null
  amount: string
  createdAt: Date
  paidAt: Date | null
}

export interface OrderWithProduct extends Order {
  productName: string
  productCategory: string
}

// ─── State Machine ──────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'REJECTED'],
  PAID: ['DELIVERED'],
  REJECTED: [],
  DELIVERED: [],
  REFUNDED: [],
}

export const ACTION_TO_STATUS: Record<OrderAction, OrderStatus> = {
  approve: 'PAID',
  reject: 'REJECTED',
  deliver: 'DELIVERED',
}
