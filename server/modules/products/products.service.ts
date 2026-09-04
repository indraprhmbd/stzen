import { eq, and, asc, desc, ilike, sql } from 'drizzle-orm'
import { db } from '../../shared/db'
import { products, productVariants, vaultItems } from '../../shared/db/schema'
import { NotFoundError } from '../../shared/errors/http'
import { getStockCount, getStockCounts } from '../../shared/lib/db-helpers'
import type { ProductWithStock, PaginatedProducts, ProductQueryParams } from './products.types'

// ─── Products Service ───────────────────────────────────────────────────────
// Business logic for product queries. Testable without HTTP.

export const productsService = {
  // Storefront: variants behave like products, 30+ SKUs
  async listActive(category?: string): Promise<ProductWithStock[]> {
    const whereClause = category
      ? and(eq(productVariants.isActive, true), eq(products.category, category))
      : eq(productVariants.isActive, true)

    const rows = await db
      .select({
        internalId: productVariants.id,
        id: productVariants.publicId,
        sku: productVariants.sku,
        name: productVariants.name,
        description: products.description,
        category: products.category,
        price: productVariants.price,
        compareAtPrice: productVariants.compareAtPrice,
        badge: productVariants.badge,
        instructions: products.instructions,
        isActive: productVariants.isActive,
        createdAt: productVariants.createdAt,
        updatedAt: productVariants.updatedAt,
        durationMonths: productVariants.durationMonths,
        accountType: productVariants.accountType,
        conditions: productVariants.conditions,
        fulfillmentType: productVariants.fulfillmentType,
        baseName: products.name,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(whereClause)
      .orderBy(products.category, productVariants.name)

    const stock = await getStockCounts(rows.map((r) => r.internalId))
    const withStock: ProductWithStock[] = rows.map((row) => {
      const { internalId, ...rest } = row as any
      return { ...rest, stockCount: stock.get(internalId) ?? 0 }
    })

    // Filter out out-of-stock variants by default
    return withStock.filter(item => item.stockCount > 0)
  },

  // Paginated storefront: server-side sort/filter/search
  async listPaginated(params: ProductQueryParams): Promise<PaginatedProducts> {
    const { category, sort = 'newest', page = 1, limit = 24, search } = params
    const offset = (page - 1) * limit

    // Where: active variants only (skip for out_of_stock view)
    const conditions = sort === 'out_of_stock' ? [] : [eq(productVariants.isActive, true)]
    if (category) conditions.push(eq(products.category, category))
    if (search) conditions.push(ilike(productVariants.name, `%${search}%`))
    const whereClause = and(...conditions)

    // Sort
    const sortMap: Record<string, ReturnType<typeof asc>> = {
      newest: desc(productVariants.createdAt),
      price: asc(productVariants.price),
      'price-asc': asc(productVariants.price),
      'price-desc': desc(productVariants.price),
      name: asc(productVariants.name),
      stock: desc(productVariants.createdAt), // stock computed, sort by newest as fallback
    }
    const orderBy = sortMap[sort] || sortMap.newest

    // Fetch ALL matching variants (not paginated yet)
    const rows = await db
      .select({
        internalId: productVariants.id,
        id: productVariants.publicId,
        sku: productVariants.sku,
        name: productVariants.name,
        description: products.description,
        category: products.category,
        price: productVariants.price,
        compareAtPrice: productVariants.compareAtPrice,
        badge: productVariants.badge,
        instructions: products.instructions,
        isActive: productVariants.isActive,
        createdAt: productVariants.createdAt,
        updatedAt: productVariants.updatedAt,
        durationMonths: productVariants.durationMonths,
        accountType: productVariants.accountType,
        conditions: productVariants.conditions,
        fulfillmentType: productVariants.fulfillmentType,
        baseName: products.name,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(whereClause)
      .orderBy(orderBy)

    // Compute stock for all variants (single batched query)
    const stock = await getStockCounts(rows.map((r) => (r as any).internalId))
    const allWithStock: ProductWithStock[] = rows.map((row) => {
      const { internalId, ...rest } = row as any
      return { ...rest, stockCount: stock.get(internalId) ?? 0 }
    })

    // Filter based on sort mode
    let filteredProducts: ProductWithStock[]
    if (sort === 'out_of_stock') {
      // Show ONLY out-of-stock variants
      filteredProducts = allWithStock.filter(item => item.stockCount === 0)
    } else {
      // Default: filter out out-of-stock variants
      filteredProducts = allWithStock.filter(item => item.stockCount > 0)
    }
    const total = filteredProducts.length

    // Paginate in JavaScript
    const paginatedProducts = filteredProducts.slice(offset, offset + limit)

    return {
      products: paginatedProducts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },

  async getById(publicId: string): Promise<ProductWithStock> {
    // try variant first (new flow)
    const [variant] = await db
      .select({
        id: productVariants.id,
        publicId: productVariants.publicId,
        sku: productVariants.sku,
        name: productVariants.name,
        price: productVariants.price,
        compareAtPrice: productVariants.compareAtPrice,
        badge: productVariants.badge,
        durationMonths: productVariants.durationMonths,
        accountType: productVariants.accountType,
        conditions: productVariants.conditions,
        fulfillmentType: productVariants.fulfillmentType,
        isActive: productVariants.isActive,
        productId: productVariants.productId,
        createdAt: productVariants.createdAt,
        updatedAt: productVariants.updatedAt,
      })
      .from(productVariants)
      .where(eq(productVariants.publicId, publicId))

    if (variant) {
      const stockCount = await getStockCount(variant.id)
      const [base] = variant.productId ? await db.select({ category: products.category, description: products.description, instructions: products.instructions }).from(products).where(eq(products.id, variant.productId)) : [{} as any]
      const { publicId: pid, ...rest } = variant as any
      return { ...rest, id: pid, category: (base as any)?.category ?? '', description: (base as any)?.description ?? null, instructions: (base as any)?.instructions ?? null, stockCount }
    }

    // fallback legacy product id
    const [product] = await db.select().from(products).where(eq(products.publicId, publicId))
    if (!product) throw new NotFoundError('Product not found')
    const stockCount = await getStockCount(product.id)
    const { publicId: pid, ...rest } = product as any
    return { ...rest, id: pid, stockCount }
  },

  async listAll() {
    const rows = await db.select().from(products).orderBy(products.createdAt)
    return rows.map((r: any) => {
      const { publicId, ...rest } = r
      return { ...rest, id: publicId }
    })
  },

  async listAllVariants() {
    const rows = await db
      .select({
        id: productVariants.publicId,
        internalId: productVariants.id,
        sku: productVariants.sku,
        name: productVariants.name,
        price: productVariants.price,
        compareAtPrice: productVariants.compareAtPrice,
        badge: productVariants.badge,
        durationMonths: productVariants.durationMonths,
        accountType: productVariants.accountType,
        conditions: productVariants.conditions,
        fulfillmentType: productVariants.fulfillmentType,
        isActive: productVariants.isActive,
        productId: productVariants.productId,
        baseName: products.name,
        category: products.category,
        createdAt: productVariants.createdAt,
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .orderBy(productVariants.createdAt)

    const withStock = await Promise.all(
      rows.map(async (r: any) => ({ ...r, stockCount: await getStockCount(r.internalId) }))
    )
    return withStock
  },
}
