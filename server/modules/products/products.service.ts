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
        internalId: products.id,
        id: products.publicId,
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

    // Attach stock counts using internal id
    const withStock: ProductWithStock[] = await Promise.all(
      rows.map(async (row) => {
        const { internalId, ...rest } = row as any
        return { ...rest, stockCount: await getStockCount(internalId) }
      })
    )

    return withStock
  },

  async getById(publicId: string): Promise<ProductWithStock> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.publicId, publicId))

    if (!product) {
      throw new NotFoundError('Product not found')
    }

    const stockCount = await getStockCount(product.id)

    // expose publicId as id externally
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
}
