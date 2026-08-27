import { eq, and } from 'drizzle-orm'
import { db } from '../../shared/db'
import { products, vaultItems } from '../../shared/db/schema'
import { NotFoundError } from '../../shared/errors/http'
import { getStockCount } from '../../shared/lib/db-helpers'
import type { ProductWithStock } from './products.types'

// ─── Products Service ───────────────────────────────────────────────────────
// Business logic for product queries. Testable without HTTP.

export const productsService = {
  async listActive(category?: string): Promise<ProductWithStock[]> {
    const whereClause = category
      ? and(eq(products.isActive, true), eq(products.category, category))
      : eq(products.isActive, true)

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        category: products.category,
        price: products.price,
        badge: products.badge,
        instructions: products.instructions,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(whereClause)
      .orderBy(products.category, products.name)

    // Attach stock counts
    const withStock: ProductWithStock[] = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        stockCount: await getStockCount(row.id),
      }))
    )

    return withStock
  },

  async getById(id: string): Promise<ProductWithStock> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))

    if (!product) {
      throw new NotFoundError('Product not found')
    }

    const stockCount = await getStockCount(id)

    return { ...product, stockCount }
  },

  async listAll() {
    return db.select().from(products).orderBy(products.createdAt)
  },
}
