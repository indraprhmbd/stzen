import { Hono } from 'hono'
import { productsService } from './products.service'

// ─── Product Routes (Public) ────────────────────────────────────────────────

export const productRoutes = new Hono()

// GET / — Active products with stock counts
productRoutes.get('/', async (c) => {
  const category = c.req.query('category')
  const catalog = await productsService.listActive(category)
  return c.json(catalog)
})

// GET /:id — Single product detail
productRoutes.get('/:id', async (c) => {
  const product = await productsService.getById(c.req.param('id'))
  return c.json(product)
})
