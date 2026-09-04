import { Hono } from 'hono'
import { adminOrderRoutes } from './admin.orders.routes'
import { adminProductRoutes } from './admin.products.routes'
import { adminStatsRoutes } from './admin.stats.routes'
import { adminHistoryRoutes } from './admin.history.routes'
import { adminAnalyticsRoutes } from './admin.analytics.routes'
import { adminVariantRoutes } from './admin.variants.routes'
import { adminSettingsRoutes } from './admin.settings.routes'

// ─── Admin Routes ───────────────────────────────────────────────────────────
// Composes admin sub-routes. Auth + role guard applied inside each sub-router.

export const adminRoutes = new Hono()

adminRoutes.route('/orders', adminOrderRoutes)
adminRoutes.route('/products', adminProductRoutes)
adminRoutes.route('/variants', adminVariantRoutes)
adminRoutes.route('/stats', adminStatsRoutes)
adminRoutes.route('/history', adminHistoryRoutes)
adminRoutes.route('/analytics', adminAnalyticsRoutes)
adminRoutes.route('/settings', adminSettingsRoutes)
