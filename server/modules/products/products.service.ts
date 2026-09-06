import { supabaseAdmin } from '../../shared/db'
import { NotFoundError } from '../../shared/errors/http'
import { getStockCount, getStockCounts } from '../../shared/lib/db-helpers'
import type { ProductWithStock, PaginatedProducts, ProductQueryParams } from './products.types'

function pickProductFields(variant: any): { category: string; description: string | null; overview: string | null; instructions: string | null; name: string } {
  const product = Array.isArray(variant.products) ? variant.products[0] : (variant.products || variant.product || {})
  return {
    category: product?.category ?? '',
    description: product?.description ?? null,
    overview: product?.overview ?? null,
    instructions: product?.instructions ?? null,
    name: product?.name ?? '',
  }
}

function mapVariantToProduct(variant: any, stockCount: number): ProductWithStock {
  const product = pickProductFields(variant)
  return {
    id: variant.public_id,
    name: variant.name,
    description: variant.description ?? product.description ?? null,
    category: product.category,
    price: String(variant.price),
    badge: variant.badge ?? null,
    isActive: variant.is_active,
    stockCount,
    fulfillmentType: variant.fulfillment_type,
    compareAtPrice: variant.compare_at_price ?? null,
    overview: variant.overview ?? product.overview ?? null,
    instructions: product.instructions ?? null,
    createdAt: variant.created_at,
    updatedAt: variant.updated_at,
  }
}

function mapProductRow(row: any, stockCount: number): ProductWithStock {
  return {
    id: row.public_id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? '',
    price: String(row.price),
    badge: row.badge ?? null,
    isActive: row.is_active,
    stockCount,
    fulfillmentType: 'vault',
    compareAtPrice: row.compare_at_price ?? null,
    overview: row.overview ?? null,
    instructions: row.instructions ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const productsService = {
  async listActive(category?: string): Promise<ProductWithStock[]> {
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id,
        public_id,
        sku,
        name,
        price,
        compare_at_price,
        badge,
        overview,
        description,
        duration_months,
        account_type,
        conditions,
        fulfillment_type,
        is_active,
        created_at,
        updated_at,
        products (
          id,
          name,
          description,
          category,
          instructions,
          overview
        )
      `)
      .eq('is_active', true)

    if (error) throw new Error(error.message)

    let filtered = (variants || []).filter((variant: any) => {
      if (!category) return true
      const cat = pickProductFields(variant).category
      return cat === category
    })

    const stockPromises = filtered.map(async (variant: any) => {
      const stockCount = await getStockCount(variant.id)
      return mapVariantToProduct(variant, stockCount)
    })

    const withStock = await Promise.all(stockPromises)
    withStock.sort((a, b) => {
      const catA = a.category
      const catB = b.category
      if (catA !== catB) return catA.localeCompare(catB)
      return a.name.localeCompare(b.name)
    })
    return withStock.filter(item => item.stockCount > 0)
  },

  async getCategoryCounts(): Promise<{ categories: string[]; counts: Record<string, number> }> {
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id,
        fulfillment_type,
        products (
          category
        )
      `)
      .eq('is_active', true)

    if (error) throw new Error(error.message)

    const variantIds = (variants || []).map((v: any) => v.id)
    const stockByVariant = await getStockCounts(variantIds)

    const categoryMap = new Map<string, number>()
    for (const variant of variants || []) {
      const isSellable = variant.fulfillment_type === 'on_demand' || (stockByVariant.get(variant.id) ?? 0) > 0
      if (!isSellable) continue
      const cat = pickProductFields(variant).category
      if (!cat) continue
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
    }

    return {
      categories: Array.from(categoryMap.keys()),
      counts: Object.fromEntries(categoryMap),
    }
  },

  async listPaginated(params: ProductQueryParams): Promise<PaginatedProducts> {
    const { category, sort = 'newest', page = 1, limit = 24, search } = params
    const offset = (page - 1) * limit

    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id,
        public_id,
        sku,
        name,
        price,
        compare_at_price,
        badge,
        overview,
        description,
        duration_months,
        account_type,
        conditions,
        fulfillment_type,
        is_active,
        created_at,
        updated_at,
        products (
          id,
          name,
          description,
          category,
          overview
        )
      `)
      .eq('is_active', true)

    if (error) throw new Error(error.message)

    let filtered = (variants || []).filter((variant: any) => {
      if (category && pickProductFields(variant).category !== category) return false
      if (search && !variant.name?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    const stockPromises = filtered.map(async (variant: any) => {
      const stockCount = await getStockCount(variant.id)
      return mapVariantToProduct(variant, stockCount)
    })

    let withStock = await Promise.all(stockPromises)

    if (sort === 'out_of_stock') {
      withStock = withStock.filter(v => v.fulfillmentType !== 'on_demand' && v.stockCount === 0)
    } else {
      withStock = withStock.filter(v => v.fulfillmentType === 'on_demand' || v.stockCount > 0)
    }

    withStock.sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return Number(a.price) - Number(b.price)
        case 'price-desc':
          return Number(b.price) - Number(a.price)
        case 'name':
          return a.name.localeCompare(b.name)
        case 'stock':
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    const total = filtered.length
    const paginated = withStock.slice(offset, offset + limit)

    return {
      products: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },

  async getById(publicId: string): Promise<ProductWithStock> {
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id,
        public_id,
        sku,
        name,
        price,
        compare_at_price,
        badge,
        overview,
        description,
        duration_months,
        account_type,
        conditions,
        fulfillment_type,
        is_active,
        product_id,
        created_at,
        updated_at,
        products (
          id,
          name,
          description,
          category,
          overview
        )
      `)
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)

    if (variants && variants.length > 0) {
      const variant = variants[0]
      const stockCount = await getStockCount(variant.id)
      return mapVariantToProduct(variant, stockCount)
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        public_id,
        name,
        description,
        category,
        instructions,
        overview,
        created_at,
        updated_at
      `)
      .eq('public_id', publicId)
      .limit(1)

    if (productError) throw new Error(productError.message)

    if (!product || product.length === 0) {
      throw new NotFoundError('Product not found')
    }

    const stockCount = await getStockCount(product[0].id)
    return mapProductRow(product[0], stockCount)
  },

  async listAll() {
    const { data: rows, error } = await supabaseAdmin
      .from('products')
      .select('public_id, id, name, description, category, price, badge, instructions, overview, is_active, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    return rows.map((r: any) => ({
      id: r.public_id,
      internalId: r.id,
      name: r.name,
      description: r.description ?? null,
      category: r.category ?? '',
      price: String(r.price),
      badge: r.badge ?? null,
      instructions: r.instructions ?? null,
      isActive: r.is_active,
      overview: r.overview ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  },

  async listAllVariants() {
    const { data: rows, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        public_id,
        id,
        sku,
        name,
        price,
        compare_at_price,
        badge,
        duration_months,
        account_type,
        conditions,
        fulfillment_type,
        is_active,
        product_id,
        created_at,
        products (
          id,
          name,
          category
        )
      `)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    const withStock = await Promise.all(
      (rows || []).map(async (r: any) => ({
        ...r,
        stockCount: await getStockCount(r.id),
      }))
    )

    return withStock
  },
}
