import { supabaseAdmin } from '../../shared/db'
import { NotFoundError } from '../../shared/errors/http'
import { getStockCount, getStockCounts } from '../../shared/lib/db-helpers'
import type { ProductWithStock, PaginatedProducts, PaginatedCatalog, CatalogCard, ProductQueryParams } from './products.types'

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
    requiresDeliveryInfo: variant.requires_delivery_info ?? false,
    compareAtPrice: variant.compare_at_price ?? null,
    overview: variant.overview ?? product.overview ?? null,
    instructions: product.instructions ?? null,
    createdAt: variant.created_at,
    updatedAt: variant.updated_at,
  }
}

function mapVariantToCard(variant: any, stockCount: number): CatalogCard {
  const product = pickProductFields(variant)
  return {
    id: variant.public_id,
    name: variant.name,
    overview: variant.overview ?? product.overview ?? null,
    category: product.category,
    price: String(variant.price),
    compareAtPrice: variant.compare_at_price ?? null,
    badge: variant.badge ?? null,
    isActive: variant.is_active,
    stockCount,
    fulfillmentType: variant.fulfillment_type,
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
    requiresDeliveryInfo: false,
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
        requires_delivery_info,
        is_active,
        product_id,
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

    const stockByVariant = await getStockCounts(filtered.map((v: any) => v.id))
    const withStock = filtered.map((variant: any) =>
      mapVariantToProduct(variant, stockByVariant.get(variant.id) ?? 0)
    )

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

  async listPaginated(params: ProductQueryParams): Promise<PaginatedCatalog> {
    const { category, sort = 'newest', page = 1, limit = 24, search } = params
    const offset = (page - 1) * limit

    // Lean card projection: only what ProductCard renders. description,
    // instructions, timestamps never leave the server on list responses
    // (detail keeps the full shape via getById).
    const CARD_COLUMNS = `
      id,
      public_id,
      name,
      price,
      compare_at_price,
      badge,
      overview,
      fulfillment_type,
      is_active,
      products (
        id,
        name,
        category
      )
    `
    // Inner join when filtering by category so PostgREST drops non-matching
    // rows in SQL instead of shipping the table for a client-side filter.
    const select = category ? CARD_COLUMNS.replace('products (', 'products!inner (') : CARD_COLUMNS
    let query = supabaseAdmin
      .from('product_variants')
      .select(select)
      .eq('is_active', true)

    if (category) {
      query = query.eq('products.category', category)
    }
    if (search) {
      const like = `%${search.replace(/[%_]/g, (c) => `\\${c}`)}%`
      query = query.ilike('name', like)
    }

    // Sort vocabulary matches the storefront FilterBar exactly.
    // newest/price/name order in SQL; stock sorts need live counts so they
    // order in memory below (rows arrive newest-first, stable sort keeps
    // that order for ties).
    switch (sort) {
      case 'price':
      case 'price-asc':
        query = query.order('price', { ascending: true })
        break
      case 'price-desc':
        query = query.order('price', { ascending: false })
        break
      case 'name':
        query = query.order('name', { ascending: true })
        break
      case 'stock':
      case 'out_of_stock':
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    const { data: variants, error } = await query

    if (error) throw new Error(error.message)

    const stockByVariant = await getStockCounts((variants || []).map((v: any) => v.id))
    let withStock = (variants || []).map((variant: any) =>
      mapVariantToCard(variant, stockByVariant.get(variant.id) ?? 0)
    )

    if (sort === 'out_of_stock') {
      withStock = withStock.filter(v => v.fulfillmentType !== 'on_demand' && v.stockCount === 0)
    } else {
      withStock = withStock.filter(v => v.fulfillmentType === 'on_demand' || v.stockCount > 0)
      if (sort === 'stock') {
        withStock.sort((a, b) => b.stockCount - a.stockCount)
      }
    }

    // Total counts what the operator actually sees (post stock filter), so
    // the pager never points at pages emptied by the sellability filter.
    const total = withStock.length
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

    const stockByVariant = await getStockCounts((rows || []).map((r: any) => r.id))

    return (rows || []).map((r: any) => ({
      ...r,
      stockCount: stockByVariant.get(r.id) ?? 0,
    }))
  },
}
