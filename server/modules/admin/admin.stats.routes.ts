import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { getIntSetting } from '../../shared/lib/settings'

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

  // GET /low-stock — bottom N variants by AVAILABLE stock, plus out/low
  // summary counts across the whole threshold set (top-N alone hides the
  // 1-4s behind a wall of zeros). Two parallel sub-ms queries.
  // Threshold defaults to the ops.low_threshold setting when the caller
  // omits it, so the configured value applies everywhere automatically.
  .get('/low-stock', async (c) => {
  const thresholdParam = c.req.query('threshold')
  const threshold = thresholdParam
    ? parseInt(thresholdParam, 10)
    : await getIntSetting('ops.low_threshold', 5, 1, 100).catch(() => 5)
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50)

  try {
    const [rows, counts] = await Promise.all([
      db.execute(sql`
        select v.public_id as id, v.name, v.sku, p.name as product_name,
               coalesce(sum(case when vi.status = 'AVAILABLE' then 1 else 0 end), 0)::int as stock_count
        from product_variants v
        join products p on p.id = v.product_id
        left join vault_items vi on vi.variant_id = v.id
        where v.is_active and v.fulfillment_type != 'on_demand'
        group by v.public_id, v.name, v.sku, p.name
        having coalesce(sum(case when vi.status = 'AVAILABLE' then 1 else 0 end), 0) < ${threshold}
        -- Nonzero urgents first so a wall of zeros never hides the 1-4s;
        -- the out-of-stock alarm lives in the summary counts instead.
        order by (coalesce(sum(case when vi.status = 'AVAILABLE' then 1 else 0 end), 0) = 0), stock_count asc
        limit ${limit}
      `) as unknown as any[],
      db.execute(sql`
        select
          (count(*) filter (where stock_count = 0))::int as out_of_stock,
          (count(*) filter (where stock_count > 0))::int as running_low
        from (
          select coalesce(sum(case when vi.status = 'AVAILABLE' then 1 else 0 end), 0)::int as stock_count
          from product_variants v
          left join vault_items vi on vi.variant_id = v.id
          where v.is_active and v.fulfillment_type != 'on_demand'
          group by v.id
          having coalesce(sum(case when vi.status = 'AVAILABLE' then 1 else 0 end), 0) < ${threshold}
        ) t
      `) as unknown as any[],
    ])

    const data = Array.isArray(rows) ? rows : (rows as any).rows ?? []
    const agg = Array.isArray(counts) ? counts[0] : (counts as any).rows?.[0]
    return c.json({ rows: data, outOfStock: agg?.out_of_stock ?? 0, runningLow: agg?.running_low ?? 0 })
  } catch (e) {
    console.error('low-stock query failed', e)
    return c.json({ rows: [], outOfStock: 0, runningLow: 0 })
  }
})
