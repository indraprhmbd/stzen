import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { products, vaultItems } from '../db/schema'

// ─── Product Routes (Public) ────────────────────────────────────────────────

const productRoutes = new Hono()

// ─── GET /products ──────────────────────────────────────────────────────────
// Public catalog: active products with live stock counts

productRoutes.get('/', async (c) => {
  const category = c.req.query('category')

  const whereClause = category
    ? and(eq(products.isActive, true), eq(products.category, category))
    : eq(products.isActive, true)

  const catalog = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      price: products.price,
      badge: products.badge,
      isActive: products.isActive,
      stockCount: db.$count(
        vaultItems,
        and(
          eq(vaultItems.productId, products.id),
          eq(vaultItems.status, 'AVAILABLE')
        )
      ),
    })
    .from(products)
    .where(whereClause)
    .orderBy(products.category, products.name)

  return c.json(catalog)
})

// ─── GET /products/:id ──────────────────────────────────────────────────────
// Single product detail with stock count

productRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      price: products.price,
      badge: products.badge,
      instructions: products.instructions,
      isActive: products.isActive,
      stockCount: db.$count(
        vaultItems,
        and(
          eq(vaultItems.productId, products.id),
          eq(vaultItems.status, 'AVAILABLE')
        )
      ),
    })
    .from(products)
    .where(eq(products.id, id))

  if (!product) {
    return c.json({ error: 'Product not found' }, 404)
  }

  return c.json(product)
})

export default productRoutes
