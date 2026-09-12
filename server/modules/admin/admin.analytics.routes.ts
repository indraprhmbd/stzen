import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'

type AnalyticsEnv = AuthEnv

export const adminAnalyticsRoutes = new Hono<AnalyticsEnv>()

  .get('/', zValidator('query', z.object({ range: z.string().optional() })), async (c) => {
    const range = c.req.query('range') || '30d'
    const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : 30
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    try {
      const [dailySalesRes, byStatusRes, byCategoryRes, topProductsRes] = await Promise.all([
        supabaseAdmin
          .from('orders')
          .select('created_at, amount')
          .gte('created_at', cutoff),
        supabaseAdmin
          .from('orders')
          .select('status', { count: 'estimated', head: false })
          .gte('created_at', cutoff),
        supabaseAdmin
          .from('products')
          .select(`
            category,
            vault_items (id)
          `),
        supabaseAdmin
          .from('orders')
          .select(`
            amount,
            products (
              name
            )
          `)
          .gte('created_at', cutoff),
      ])

      // Daily sales
      const dailySalesMap = new Map<string, { label: string; date: string; count: number; revenue: number }>()
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        dailySalesMap.set(dateStr, { label, date: dateStr, count: 0, revenue: 0 })
      }

      for (const order of dailySalesRes.data || []) {
        const dateStr = (order as any).created_at?.split('T')[0]
        if (!dateStr || !dailySalesMap.has(dateStr)) continue
        const entry = dailySalesMap.get(dateStr)!
        entry.count += 1
        entry.revenue += parseInt((order as any).amount || '0', 10)
      }

      const dailySales = Array.from(dailySalesMap.values())

      // By status
      const byStatusMap = new Map<string, number>()
      for (const order of byStatusRes.data || []) {
        byStatusMap.set((order as any).status, (byStatusMap.get((order as any).status) || 0) + 1)
      }
      const byStatus = Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count }))

      // By category
      const byCategoryMap = new Map<string, number>()
      for (const product of byCategoryRes.data || []) {
        const cat = (product as any).category || 'Uncategorized'
        const stock = (product as any).vault_items?.length || 0
        byCategoryMap.set(cat, (byCategoryMap.get(cat) || 0) + stock)
      }
      const byCategory = Array.from(byCategoryMap.entries())
        .map(([category, stock]) => ({ category, stock }))
        .sort((a, b) => b.stock - a.stock)

      // Top products
      const topProductsMap = new Map<string, number>()
      for (const order of topProductsRes.data || []) {
        const product = Array.isArray(order.products) ? order.products[0] : (order.products || {})
        const name = product?.name || 'Unknown'
        topProductsMap.set(name, (topProductsMap.get(name) || 0) + 1)
      }
      const topProducts = Array.from(topProductsMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      return c.json({
        dailySales,
        byStatus,
        byCategory,
        topProducts,
      })
    } catch (e) {
      console.error('analytics failed', e)
      return c.json({ dailySales: [], byStatus: [], byCategory: [], topProducts: [] })
    }
  })
