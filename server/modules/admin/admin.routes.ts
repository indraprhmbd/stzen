import { Hono } from 'hono'
import { adminOrderRoutes } from './admin.orders.routes'
import { adminProductRoutes } from './admin.products.routes'
import { adminStatsRoutes } from './admin.stats.routes'

// ─── Admin Routes ───────────────────────────────────────────────────────────
// Composes admin sub-routes. Auth + role guard applied inside each sub-router.

export const adminRoutes = new Hono()

adminRoutes.route('/orders', adminOrderRoutes)
adminRoutes.route('/products', adminProductRoutes)
adminRoutes.route('/stats', adminStatsRoutes)
