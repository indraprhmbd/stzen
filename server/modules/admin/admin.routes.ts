import { Hono } from 'hono'
import { requireRole } from '../../shared/middleware/require-role'
import { adminOrderRoutes } from './admin.orders.routes'
import { adminProductRoutes } from './admin.products.routes'
import { adminStatsRoutes } from './admin.stats.routes'
import { adminHistoryRoutes } from './admin.history.routes'
import { adminAnalyticsRoutes } from './admin.analytics.routes'
import { adminVariantRoutes } from './admin.variants.routes'
import { adminSettingsRoutes } from './admin.settings.routes'
import { adminVaultRoutes } from './admin.vault.routes'
import { routes as dangerRoutes } from '../danger'

// ─── Admin Routes ───────────────────────────────────────────────────────────
// Composes admin sub-routes. Single central guard: conceal=true returns 404
// for non-admin callers so /api/v1/admin/* existence is never confirmed.
// Guard registered BEFORE .route() mounts: Hono runs handlers in
// registration order, so a .use() placed after .route() would never block.
// Per-file guards were removed from each sub-router to keep one policy point.

export const adminRoutes = new Hono()
  .use('*', requireRole('admin', { conceal: true }))
  .route('/orders', adminOrderRoutes)
  .route('/products', adminProductRoutes)
  .route('/variants', adminVariantRoutes)
  .route('/stats', adminStatsRoutes)
  .route('/history', adminHistoryRoutes)
  .route('/analytics', adminAnalyticsRoutes)
  .route('/settings', adminSettingsRoutes)
  .route('/vault', adminVaultRoutes)
  .route('/danger', dangerRoutes)
