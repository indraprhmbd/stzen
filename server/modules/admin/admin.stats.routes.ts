import { Hono } from 'hono'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { getIntSetting } from '../../shared/lib/settings'

type AdminStatsEnv = AuthEnv

export const adminStatsRoutes = new Hono<AdminStatsEnv>()
  .use('*', requireRole('admin'))

  .get('/', async (c) => {
    try {
      const [{ count: totalProducts }, { count: totalStock }, { count: pendingOrders }, { data: paidOrders }] = await Promise.all([
        supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('vault_items').select('*', { count: 'exact', head: true }).eq('status', 'AVAILABLE'),
        supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabaseAdmin.from('orders').select('amount').in('status', ['PAID', 'DELIVERED']),
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
      const { data: variants, error } = await supabaseAdmin
        .from('product_variants')
        .select(`
          public_id,
          name,
          sku,
          product_id,
          products (
            name
          )
        `)
        .eq('is_active', true)
        .neq('fulfillment_type', 'on_demand')

      if (error) throw new Error(error.message)

      const stockPromises = (variants || []).map(async (variant: any) => {
        const product = Array.isArray(variant.products) ? variant.products[0] : (variant.products || {})
        const { count } = await supabaseAdmin
          .from('vault_items')
          .select('*', { count: 'exact', head: true })
          .eq('variant_id', variant.id)
          .eq('status', 'AVAILABLE')

        return {
          id: variant.public_id,
          name: variant.name,
          sku: variant.sku,
          product_name: product?.name,
          stock_count: count || 0,
        }
      })

      const rows = await Promise.all(stockPromises)
      const lowStock = rows
        .filter((r) => r.stock_count < threshold)
        .sort((a, b) => {
          if (a.stock_count === 0 && b.stock_count !== 0) return -1
          if (a.stock_count !== 0 && b.stock_count === 0) return 1
          return a.stock_count - b.stock_count
        })
        .slice(0, limit)

      const outOfStock = rows.filter((r) => r.stock_count === 0).length
      const runningLow = rows.filter((r) => r.stock_count > 0 && r.stock_count < threshold).length

      return c.json({ rows: lowStock, outOfStock, runningLow })
    } catch (e) {
      console.error('low-stock query failed', e)
      return c.json({ rows: [], outOfStock: 0, runningLow: 0 })
    }
  })
