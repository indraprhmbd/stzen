import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'

type AnalyticsEnv = AuthEnv

export const adminAnalyticsRoutes = new Hono<AnalyticsEnv>()

// Auth is enforced globally in app.ts; this only adds the role check.
adminAnalyticsRoutes.use('*', requireRole('admin'))

// GET / — analytics for 30d dense dashboard
adminAnalyticsRoutes.get('/', async (c) => {
  const range = c.req.query('range') || '30d'
  const days = range === '7d' ? 7 : range === '14d' ? 14 : 30

  try {
    // daily sales last N days
    const dailySales = await db.execute(sql`
      select to_char(d::date, 'DD Mon') as label,
             to_char(d::date, 'YYYY-MM-DD') as date,
             coalesce(count(o.id),0)::int as count,
             coalesce(sum(o.amount),0)::int as revenue
      from generate_series(now() - ${days - 1}::int * interval '1 day', now(), '1 day'::interval) d(d)
      left join orders o on date_trunc('day', o.created_at) = d::date
      group by d::date
      order by d::date
    `) as unknown as any[]

    const rowsSales: any[] = Array.isArray(dailySales) ? dailySales : (dailySales as any).rows ?? []

    // by status
    const byStatus = await db.execute(sql`
      select status, count(*)::int as count from orders group by status
    `) as unknown as any[]
    const rowsStatus: any[] = Array.isArray(byStatus) ? byStatus : (byStatus as any).rows ?? []

    // stock by category
    const byCategory = await db.execute(sql`
      select p.category, count(v.id)::int as stock
      from products p
      left join vault_items v on v.product_id = p.id and v.status = 'AVAILABLE'
      group by p.category
      order by stock desc
    `) as unknown as any[]
    const rowsCat: any[] = Array.isArray(byCategory) ? byCategory : (byCategory as any).rows ?? []

    // top 5 products last 30d
    const topProducts = await db.execute(sql`
      select p.name, count(o.id)::int as count
      from orders o
      join products p on p.id = o.product_id
      where o.created_at >= now() - interval '30 days'
      group by p.name
      order by count desc
      limit 5
    `) as unknown as any[]
    const rowsTop: any[] = Array.isArray(topProducts) ? topProducts : (topProducts as any).rows ?? []

    return c.json({
      dailySales: rowsSales,
      byStatus: rowsStatus,
      byCategory: rowsCat,
      topProducts: rowsTop,
    })
  } catch (e) {
    console.error('analytics failed', e)
    return c.json({ dailySales: [], byStatus: [], byCategory: [], topProducts: [] })
  }
})
