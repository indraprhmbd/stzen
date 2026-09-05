import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'

type AdminStatsEnv = AuthEnv

export const adminStatsRoutes = new Hono<AdminStatsEnv>()
  // Auth is enforced globally in app.ts; this only adds the role check.
  .use('*', requireRole('admin'))

  // GET / — Single roundtrip to avoid max:1 pool contention (was 4 parallel selects)
  .get('/', async (c) => {
  try {
    const [row] = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM products) as total_products,
        (SELECT count(*) FROM vault_items WHERE status = 'AVAILABLE') as total_stock,
        (SELECT count(*) FROM orders WHERE status = 'PENDING') as pending_orders,
        (SELECT coalesce(sum(amount),0) FROM orders WHERE status IN ('PAID','DELIVERED')) as revenue
    `) as unknown as Array<{ total_products: string; total_stock: string; pending_orders: string; revenue: string }>

    return c.json({
      totalProducts: Number(row.total_products),
      totalStock: Number(row.total_stock),
      pendingOrders: Number(row.pending_orders),
      revenue: String(row.revenue),
    })
  } catch (e) {
    console.error('stats query failed', e)
    return c.json({ totalProducts: 0, totalStock: 0, pendingOrders: 0, revenue: '0' })
  }
})

  // GET /low-stock — top N products below threshold. Single query, no full product table scan.
  .get('/low-stock', async (c) => {
  const threshold = parseInt(c.req.query('threshold') || '5', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50)

  try {
    const rows = await db.execute(sql`
      select p.public_id as id, p.name, p.category,
             coalesce(sum(case when v.status = 'AVAILABLE' then 1 else 0 end), 0)::int as stock_count
      from products p
      left join vault_items v on v.product_id = p.id
      group by p.public_id, p.name, p.category
      having coalesce(sum(case when v.status = 'AVAILABLE' then 1 else 0 end), 0) < ${threshold}
      order by stock_count asc
      limit ${limit}
    `) as unknown as any[]

    const data = Array.isArray(rows) ? rows : (rows as any).rows ?? []
    return c.json(data)
  } catch (e) {
    console.error('low-stock query failed', e)
    return c.json([])
  }
})
