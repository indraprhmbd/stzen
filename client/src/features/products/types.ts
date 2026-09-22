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
  stockCount: number
}

export interface Variant {
  id: string
  sku: string
  name: string
  overview?: string | null
  description?: string | null
  price: string | number
  compareAtPrice?: number | null
  costPrice?: number | null
  badge: string | null
  durationMonths: number | null
  durationUnit: string
  accountType: string | null
  conditions: string | null
  fulfillmentType: string
  allowBackorder?: boolean
  requiresDeliveryInfo: boolean
  isActive: boolean
  stockCount: number
  productId: string | null
  baseName?: string
  category?: string
}

export interface FormData {
  name: string
  category: string
  price: string
  badge: string
  overview: string
  description: string
  instructions: string
  isActive: boolean
}

export const emptyForm: FormData = { name: '', category: '', price: '', badge: '', overview: '', description: '', instructions: '', isActive: true }

export interface VariantGroup {
  key: string
  productId: string | null
  label: string
  items: Variant[]
}
