// ─── Product Types ──────────────────────────────────────────────────────────

export interface Product {
  id: string
  name: string
  overview: string | null
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

// Lean card projection for the public list: exactly what ProductCard renders.
// Detail page keeps the full ProductWithStock via getById.
export interface CatalogCard {
  id: string
  name: string
  overview: string | null
  category: string
  price: string
  compareAtPrice?: number | null
  badge: string | null
  isActive: boolean
  stockCount: number
  fulfillmentType?: string
}

export interface PaginatedCatalog {
  products: CatalogCard[]
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
