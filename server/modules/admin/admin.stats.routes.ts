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
    // Threshold defaults to the ops.low_threshold setting (Admin > Settings)
    // when the caller omits it, so the widget always respects the operator's
    // warning level. Full under-threshold set, paged server-side (page/limit)
    // and sorted by SISA (sortDir asc = most urgent first).
    const thresholdParam = c.req.query('threshold')
    const threshold = thresholdParam
      ? parseInt(thresholdParam, 10)
      : await getIntSetting('ops.low_threshold', 5, 1, 100).catch(() => 5)
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '5', 10), 1), 50)
    const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1)
    const desc = c.req.query('sortDir') === 'desc'

    try {
      // Single GROUP BY aggregate per call (migration 0011/0012): threshold,
      // sort and page apply in SQL, replacing the old 1+V per-variant loop.
      const [{ data: rows, error: rowsError }, { data: summary, error: summaryError }, { data: byProduct, error: byProductError }] = await Promise.all([
        supabaseAdmin.rpc('low_stock_variants', {
          p_threshold: threshold,
          p_limit: limit,
          p_offset: (page - 1) * limit,
          p_desc: desc,
        }),
        supabaseAdmin.rpc('low_stock_summary', { p_threshold: threshold }),
        supabaseAdmin.rpc('low_stock_by_product', { p_threshold: threshold }),
      ])

      if (rowsError) throw new Error(rowsError.message)
      if (summaryError) throw new Error(summaryError.message)
      if (byProductError) throw new Error(byProductError.message)

      const s = Array.isArray(summary) ? summary[0] : summary
      const outOfStock = Number(s?.out_of_stock ?? 0)
      const runningLow = Number(s?.running_low ?? 0)
      const total = outOfStock + runningLow
      return c.json({
        rows: (rows || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          sku: r.sku,
          product_name: r.product_name,
          stock_count: Number(r.stock_count ?? 0),
        })),
        outOfStock,
        runningLow,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        // Per-product habis breakdown for the Overview tile (full coverage,
        // not page-bound). Variant-level rows stay in `rows` only.
        byProduct: (byProduct || []).map((r: any) => ({
          product_name: r.product_name,
          count: Number(r.empty_count ?? 0),
        })),
      })
    } catch (e) {
      console.error('low-stock query failed', e)
      return c.json({ rows: [], outOfStock: 0, runningLow: 0, total: 0, page, limit, totalPages: 1, byProduct: [] })
    }
  })
