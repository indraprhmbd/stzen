import { Hono } from 'hono'
import { adminOrderRoutes } from './admin.orders.routes'
import { adminProductRoutes } from './admin.products.routes'
import { adminStatsRoutes } from './admin.stats.routes'
import { adminHistoryRoutes } from './admin.history.routes'
import { adminAnalyticsRoutes } from './admin.analytics.routes'
import { adminVariantRoutes } from './admin.variants.routes'
import { adminSettingsRoutes } from './admin.settings.routes'
import { adminVaultRoutes } from './admin.vault.routes'

// ─── Admin Routes ───────────────────────────────────────────────────────────
// Composes admin sub-routes. Auth + role guard applied inside each sub-router.

export const adminRoutes = new Hono()
  .route('/orders', adminOrderRoutes)
  .route('/products', adminProductRoutes)
  .route('/variants', adminVariantRoutes)
  .route('/stats', adminStatsRoutes)
  .route('/history', adminHistoryRoutes)
  .route('/analytics', adminAnalyticsRoutes)
  .route('/settings', adminSettingsRoutes)
  .route('/vault', adminVaultRoutes)
