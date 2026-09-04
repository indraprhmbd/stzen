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
  fulfillmentType?: string
  compareAtPrice?: number | null
}

export interface PaginatedProducts {
  products: ProductWithStock[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ProductQueryParams {
  category?: string
  sort?: string
  page?: number
  limit?: number
  search?: string
}
