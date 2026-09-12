import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { type AuthEnv } from '../../shared/middleware/auth'
import { dangerService } from './danger.service'
import { StalePreviewSchema } from './danger.schema'

// ─── Danger Zone Routes ─────────────────────────────────────────────────────
// Tiered destructive ops for admin/settings. Auth + admin role enforced
// globally (app.ts gate, admin.routes.ts conceal guard). Every execute
// endpoint (added next) requires preview-first, typed phrase, and audit.

export const dangerRoutes = new Hono<AuthEnv>()
  // Tier 1 preview: abandoned PENDING orders older than N days.
  .get('/stale-orders/preview', zValidator('query', StalePreviewSchema), async (c) => {
    const q = c.req.valid('query')
    return c.json(await dangerService.previewStaleOrders(q.olderThanDays))
  })

  // Tier 2 preview: product blast radius (variants, vault, orders).
  .get('/products/:id/preview', async (c) => {
    return c.json(await dangerService.previewProduct(c.req.param('id')))
  })

  // Tier 2 preview: variant blast radius (vault, orders).
  .get('/variants/:id/preview', async (c) => {
    return c.json(await dangerService.previewVariant(c.req.param('id')))
  })

  // Tier 3 preview: purgeable terminal rows per kind.
  .get('/purge/:kind/preview', async (c) => {
    const kind = c.req.param('kind')
    if (kind !== 'orders' && kind !== 'vault') {
      return c.json({ error: 'Jenis purge tidak dikenal' }, 400)
    }
    return c.json(await dangerService.previewPurge(kind))
  })
