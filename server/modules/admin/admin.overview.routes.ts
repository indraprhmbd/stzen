import { Hono } from 'hono'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { getIntSetting } from '../../shared/lib/settings'

type OverviewEnv = AuthEnv

// ─── Admin Overview (composite) ─────────────────────────────────────────────
// One round trip for the Overview page: stats tiles + analytics charts +
// recent actionable orders + low-stock rows. Previously 4 parallel client
// calls that scanned the same orders window twice (stats revenue +
// analytics dailySales) and counted every variant (low-stock N+1).
// Shape mirrors the four legacy payloads so the client render path is
// unchanged; legacy endpoints stay for direct links/deep refreshes.

function rangeCutoff(range: string): { days: number; cutoff: string } {
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : 30
  return { days, cutoff: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() }
}

export const adminOverviewRoutes = new Hono<OverviewEnv>()

  .get('/', async (c) => {
    const range = c.req.query('range') || '30d'
    const { days, cutoff } = rangeCutoff(range)
    const thresholdParam = c.req.query('threshold')
    const threshold = thresholdParam
      ? parseInt(thresholdParam, 10)
      : await getIntSetting('ops.low_threshold', 5, 1, 100).catch(() => 5)
    const lowLimit = Math.min(parseInt(c.req.query('limit') || '5', 10), 50)

    try {
      const [
        { count: totalProducts },
        { count: totalStock },
        { count: pendingOrders },
        { data: paidOrders },
        dailySalesRes,
        byStatusRes,
        byCategoryRes,
        topProductsRes,
        { data: recentOrders, error: recentError },
        { data: lowRows, error: lowRowsError },
        { data: lowSummary, error: lowSummaryError },
      ] = await Promise.all([
        supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('vault_items').select('*', { count: 'estimated', head: true }).eq('status', 'AVAILABLE'),
        supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabaseAdmin.from('orders').select('amount').in('status', ['PAID', 'DELIVERED']).gte('created_at', cutoff),
        supabaseAdmin.from('orders').select('created_at, amount').gte('created_at', cutoff),
        supabaseAdmin.from('orders').select('status').gte('created_at', cutoff),
        supabaseAdmin.from('products').select('category, vault_items (id)'),
        supabaseAdmin.from('orders').select('amount, products (name)').gte('created_at', cutoff),
        supabaseAdmin
          .from('orders')
          .select('public_id, amount, status, created_at, products (name), profiles (email)')
          .in('status', ['PENDING', 'PAID'])
          .order('created_at', { ascending: true })
          .limit(5),
        supabaseAdmin.rpc('low_stock_variants', { p_threshold: threshold, p_limit: lowLimit }),
        supabaseAdmin.rpc('low_stock_summary', { p_threshold: threshold }),
      ])

      if (recentError) throw new Error(recentError.message)
      if (lowRowsError) throw new Error(lowRowsError.message)
      if (lowSummaryError) throw new Error(lowSummaryError.message)

      const revenue = (paidOrders || []).reduce((sum, order) => sum + parseInt((order as any).amount || '0', 10), 0)

      const dailySalesMap = new Map<string, { label: string; date: string; count: number; revenue: number }>()
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        dailySalesMap.set(dateStr, {
          label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          date: dateStr,
          count: 0,
          revenue: 0,
        })
      }
      for (const order of dailySalesRes.data || []) {
        const dateStr = (order as any).created_at?.split('T')[0]
        if (!dateStr || !dailySalesMap.has(dateStr)) continue
        const entry = dailySalesMap.get(dateStr)!
        entry.count += 1
        entry.revenue += parseInt((order as any).amount || '0', 10)
      }

      const byStatusMap = new Map<string, number>()
      for (const order of byStatusRes.data || []) {
        byStatusMap.set((order as any).status, (byStatusMap.get((order as any).status) || 0) + 1)
      }

      const byCategoryMap = new Map<string, number>()
      for (const product of byCategoryRes.data || []) {
        const cat = (product as any).category || 'Uncategorized'
        byCategoryMap.set(cat, (byCategoryMap.get(cat) || 0) + ((product as any).vault_items?.length || 0))
      }

      const topProductsMap = new Map<string, number>()
      for (const order of topProductsRes.data || []) {
        const product = Array.isArray((order as any).products) ? (order as any).products[0] : ((order as any).products || {})
        const name = product?.name || 'Unknown'
        topProductsMap.set(name, (topProductsMap.get(name) || 0) + 1)
      }

      const summary = Array.isArray(lowSummary) ? lowSummary[0] : lowSummary

      return c.json({
        stats: {
          totalProducts: totalProducts || 0,
          totalStock: totalStock || 0,
          pendingOrders: pendingOrders || 0,
          revenue: String(revenue),
        },
        analytics: {
          dailySales: Array.from(dailySalesMap.values()),
          byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
          byCategory: Array.from(byCategoryMap.entries())
            .map(([category, stock]) => ({ category, stock }))
            .sort((a, b) => b.stock - a.stock),
          topProducts: Array.from(topProductsMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        },
        orders: (recentOrders || []).map((r: any) => {
          const product = Array.isArray(r.products) ? r.products[0] : (r.products || {})
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : (r.profiles || {})
          return {
            id: r.public_id,
            productName: product?.name ?? '',
            customerEmail: profile?.email ?? null,
            amount: String(r.amount),
            status: r.status,
            createdAt: r.created_at,
          }
        }),
        lowStock: {
          rows: (lowRows || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            sku: r.sku,
            product_name: r.product_name,
            stock_count: Number(r.stock_count ?? 0),
          })),
          outOfStock: Number(summary?.out_of_stock ?? 0),
          runningLow: Number(summary?.running_low ?? 0),
        },
      })
    } catch (e) {
      console.error('overview composite failed', e)
      return c.json({
        stats: { totalProducts: 0, totalStock: 0, pendingOrders: 0, revenue: '0' },
        analytics: { dailySales: [], byStatus: [], byCategory: [], topProducts: [] },
        orders: [],
        lowStock: { rows: [], outOfStock: 0, runningLow: 0 },
      })
    }
  })
