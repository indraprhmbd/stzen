import { Hono } from 'hono'
import { productsService } from './products.service'
import type { ProductQueryParams } from './products.types'

// ─── Product Routes (Public) ────────────────────────────────────────────────

export const productRoutes = new Hono()

// GET / — Paginated active products with sort/search/filter
productRoutes.get('/', async (c) => {
  const category = c.req.query('category') || undefined
  const sort = c.req.query('sort') || undefined
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '24')
  const search = c.req.query('search') || undefined

  // If any query params present, use paginated endpoint
  if (category || sort || page > 1 || search || limit !== 24) {
    const params: ProductQueryParams = { category, sort, page, limit, search }
    const result = await productsService.listPaginated(params)
    return c.json(result)
  }

  // Default: legacy flat list for homepage featured card
  const catalog = await productsService.listActive(category)
  return c.json(catalog)
})

// GET /categories — Unique category list with counts
productRoutes.get('/categories', async (c) => {
  const rows = await productsService.listActive()
  const counts: Record<string, number> = {}
  rows.forEach((p) => {
    counts[p.category] = (counts[p.category] || 0) + 1
  })
  return c.json({ categories: Object.keys(counts), counts })
})

// GET /:id — Single product detail
productRoutes.get('/:id', async (c) => {
  const product = await productsService.getById(c.req.param('id'))
  return c.json(product)
})
