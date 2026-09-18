import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { productsService } from './products.service'
import { ProductQuerySchema } from './products.schema'
import type { ProductQueryParams } from './products.types'

// ─── Product Routes (Public) ────────────────────────────────────────────────

export const productRoutes = new Hono()
  // GET / - Paginated active products with sort/search/filter.
  // Always the paginated shape (defaults page 1, limit 24): one contract
  // for every consumer. listActive stays for /categories counts.
  .get('/', zValidator('query', ProductQuerySchema), async (c) => {
  const category = c.req.query('category') || undefined
  const tags = c.req.query('tags') || undefined
  const sort = c.req.query('sort') || undefined
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '24')
  const search = c.req.query('search') || undefined

  const params: ProductQueryParams = { category, tags, sort, page, limit, search }
  const result = await productsService.listPaginated(params)
  // Public catalog: edge-cached (Workers Cache) + browser. Purged by tag on
  // admin writes; 60s TTL is the safety net for order-driven stock changes.
  c.header('Cache-Control', 'public, max-age=60')
  c.header('Cache-Tag', 'catalog')
  return c.json(result)
})

// GET /categories - Unique category list with counts (aggregate only, no rows)
  .get('/categories', async (c) => {
  c.header('Cache-Control', 'public, max-age=60')
  c.header('Cache-Tag', 'catalog')
  return c.json(await productsService.getCategoryCounts())
})

// GET /:id - Single product detail
  .get('/:id', async (c) => {
  const product = await productsService.getById(c.req.param('id'))
  c.header('Cache-Control', 'public, max-age=60')
  c.header('Cache-Tag', 'catalog')
  return c.json(product)
})
