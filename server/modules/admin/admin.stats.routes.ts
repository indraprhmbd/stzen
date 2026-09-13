import { Hono } from 'hono'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { getIntSetting } from '../../shared/lib/settings'

type AdminStatsEnv = AuthEnv

export const adminStatsRoutes = new Hono<AdminStatsEnv>()

  .get('/', async (c) => {
    // Revenue respects the range tabs (rolling window on order creation,
    // same basis as the analytics charts). Stock/product/pending counts are
    // point-in-time and stay global.
    const range = c.req.query('range') || '30d'
    const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : 30
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    try {
      const [{ count: totalProducts }, { count: totalStock }, { count: pendingOrders }, { data: paidOrders }] = await Promise.all([
        supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
        // vault_items grows fastest of all tables; estimated keeps the tile cheap.
        supabaseAdmin.from('vault_items').select('*', { count: 'estimated', head: true }).eq('status', 'AVAILABLE'),
        supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabaseAdmin.from('orders').select('amount').in('status', ['PAID', 'DELIVERED']).gte('created_at', cutoff),
      ])

      const revenue = (paidOrders || []).reduce((sum, order) => sum + (parseInt((order as any).amount || '0', 10)), 0)

      return c.json({
        totalProducts: totalProducts || 0,
        totalStock: totalStock || 0,
        pendingOrders: pendingOrders || 0,
        revenue: String(revenue),
      })
    } catch (e) {
      console.error('stats query failed', e)
      return c.json({ totalProducts: 0, totalStock: 0, pendingOrders: 0, revenue: '0' })
    }
  })

  .get('/low-stock', async (c) => {
    const thresholdParam = c.req.query('threshold')
    const threshold = thresholdParam
      ? parseInt(thresholdParam, 10)
      : await getIntSetting('ops.low_threshold', 5, 1, 100).catch(() => 5)
    const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50)

    try {
      // Single GROUP BY aggregate per call (migration 0011): threshold and
      // limit apply in SQL, replacing the old 1+V per-variant count loop.
      const [{ data: rows, error: rowsError }, { data: summary, error: summaryError }] = await Promise.all([
        supabaseAdmin.rpc('low_stock_variants', { p_threshold: threshold, p_limit: limit }),
        supabaseAdmin.rpc('low_stock_summary', { p_threshold: threshold }),
      ])

      if (rowsError) throw new Error(rowsError.message)
      if (summaryError) throw new Error(summaryError.message)

      const s = Array.isArray(summary) ? summary[0] : summary
      return c.json({
        rows: (rows || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          sku: r.sku,
          product_name: r.product_name,
          stock_count: Number(r.stock_count ?? 0),
        })),
        outOfStock: Number(s?.out_of_stock ?? 0),
        runningLow: Number(s?.running_low ?? 0),
      })
    } catch (e) {
      console.error('low-stock query failed', e)
      return c.json({ rows: [], outOfStock: 0, runningLow: 0 })
    }
  })
