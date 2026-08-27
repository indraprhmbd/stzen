// ─── Product Types ──────────────────────────────────────────────────────────

export interface Product {
  id: string
  name: string
  description: string | null
  category: string
  price: string
  badge: string | null
  instructions: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ProductWithStock extends Product {
  stockCount: number
}
