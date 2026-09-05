import { eq, and, asc, desc, ilike, sql, or, ne, not, exists } from 'drizzle-orm'
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

  // Category counts without fetching rows — the /categories endpoint only
  // needs names + counts. Same sellable filter as listPaginated (active +
  // on_demand-or-in-stock) so badges match list results. Never select
  // instruction payloads here.
  async getCategoryCounts(): Promise<{ categories: string[]; counts: Record<string, number> }> {
    const hasStock = exists(
      db.select({ one: sql`1` }).from(vaultItems).where(
        and(eq(vaultItems.variantId, productVariants.id), eq(vaultItems.status, 'AVAILABLE'))
      )
    )
    const rows = await db
      .select({
        category: products.category,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.isActive, true),
          or(eq(productVariants.fulfillmentType, 'on_demand'), hasStock)!
        )
      )
      .groupBy(products.category)
    const counts: Record<string, number> = {}
    for (const r of rows) counts[r.category] = r.count
    return { categories: Object.keys(counts), counts }
  },

  // Paginated storefront: server-side sort/filter/search
  async listPaginated(params: ProductQueryParams): Promise<PaginatedProducts> {
    const { category, sort = 'newest', page = 1, limit = 24, search } = params
    const offset = (page - 1) * limit

    // Where: active variants only (skip for out_of_stock view)
    const conditions = sort === 'out_of_stock' ? [] : [eq(productVariants.isActive, true)]
    if (category) conditions.push(eq(products.category, category))
    if (search) conditions.push(ilike(productVariants.name, `%${search}%`))

    // Stock filter in SQL so LIMIT applies to sellable rows, not pre-filter rows.
    // on_demand variants are always sellable; vault variants need an AVAILABLE item.
    const hasStock = exists(
      db.select({ one: sql`1` }).from(vaultItems).where(
        and(eq(vaultItems.variantId, productVariants.id), eq(vaultItems.status, 'AVAILABLE'))
      )
    )
    if (sort === 'out_of_stock') {
      conditions.push(ne(productVariants.fulfillmentType, 'on_demand'))
      conditions.push(not(hasStock))
    } else {
      conditions.push(or(eq(productVariants.fulfillmentType, 'on_demand'), hasStock)!)
    }
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

    // Exact total for pagination (cheap count, same filter)
    const [{ count: total }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(whereClause)

    // Page rows only — LIMIT now applies to sellable rows, not pre-filter rows.
    // Minimal card projection: cards render name/description/category/price/
    // badge/stock only. Everything else (sku, timestamps, duration, account
    // type, conditions, baseName, instructions) is detail-endpoint data —
    // never ship it to list callers, guest or not.
    const rows = await db
      .select({
        internalId: productVariants.id,
        id: productVariants.publicId,
        name: productVariants.name,
        description: products.description,
        category: products.category,
        price: productVariants.price,
        compareAtPrice: productVariants.compareAtPrice,
        badge: productVariants.badge,
        isActive: productVariants.isActive,
        fulfillmentType: productVariants.fulfillmentType,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    // Stock counts for the page only (single batched query over ≤limit ids).
    const stock = await getStockCounts(rows.map((r) => (r as any).internalId))
    const paginatedProducts: ProductWithStock[] = rows.map((row) => {
      const { internalId, ...rest } = row as any
      return { ...rest, stockCount: stock.get(internalId) ?? 0 }
    })

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
        overview: productVariants.overview,
        description: productVariants.description,
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
      const [base] = variant.productId ? await db.select({ category: products.category, description: products.description, overview: products.overview }).from(products).where(eq(products.id, variant.productId)) : [{} as any]
      // Strip internal productId; instructions are post-delivery only (credentials endpoint).
      // Content fallback: variant wins, induk fills gaps.
      const { publicId: pid, productId: _internalBase, ...rest } = variant as any
      return { ...rest, id: pid, category: (base as any)?.category ?? '', overview: (variant as any).overview ?? (base as any)?.overview ?? null, description: (variant as any).description ?? (base as any)?.description ?? null, stockCount }
    }

    // fallback legacy product id
    const [product] = await db.select().from(products).where(eq(products.publicId, publicId))
    if (!product) throw new NotFoundError('Product not found')
    const stockCount = await getStockCount(product.id)
    const { publicId: pid, instructions: _gated, ...rest } = product as any
    return { ...rest, id: pid, stockCount }
  },

  async listAll() {
    const rows = await db.select().from(products).orderBy(products.createdAt)
    return rows.map((r: any) => {
      const { publicId, id: internalId, ...rest } = r
      return { ...rest, id: publicId, internalId }
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
