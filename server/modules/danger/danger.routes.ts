import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { type AuthEnv } from '../../shared/middleware/auth'
import { dangerService, dangerExecute } from './danger.service'
import { StalePreviewSchema, StaleRejectSchema, CatalogDeleteSchema, ExportSchema, PurgeSchema } from './danger.schema'

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

  // Tier 1 execute: bulk-reject abandoned PENDING. Capped per call; repeat
  // until preview hits zero. Webhook races land in `skipped`, never corrupt.
  .post('/stale-orders/reject', zValidator('json', StaleRejectSchema), async (c) => {
    const user = c.get('user')
    const { olderThanDays } = c.req.valid('json')
    return c.json(await dangerExecute.rejectStaleOrders(olderThanDays, { sub: user.sub, email: user.email }))
  })

  // Tier 2 execute: product cascade (phrase must equal the product public_id).
  .delete('/products/:id', zValidator('json', CatalogDeleteSchema), async (c) => {
    const user = c.get('user')
    const { phrase } = c.req.valid('json')
    return c.json(await dangerExecute.deleteProduct(c.req.param('id'), phrase, { sub: user.sub, email: user.email }))
  })

  // Tier 2 execute: variant delete (phrase must equal the variant public_id).
  .delete('/variants/:id', zValidator('json', CatalogDeleteSchema), async (c) => {
    const user = c.get('user')
    const { phrase } = c.req.valid('json')
    return c.json(await dangerExecute.deleteVariant(c.req.param('id'), phrase, { sub: user.sub, email: user.email }))
  })

  // Tier 3: export gate. Returns CSV payload + single-use token authorizing
  // exactly the exported filter. Client downloads the CSV, then purge unlocks.
  .post('/export', zValidator('json', ExportSchema), async (c) => {
    const user = c.get('user')
    const { kind } = c.req.valid('json')
    return c.json(await dangerExecute.buildExport(kind, { sub: user.sub, email: user.email }))
  })

  // Tier 3 execute: purge terminal rows. Token burned on first use; replays 409.
  .post('/purge', zValidator('json', PurgeSchema), async (c) => {
    const user = c.get('user')
    const { exportToken } = c.req.valid('json')
    return c.json(await dangerExecute.purge(exportToken, { sub: user.sub, email: user.email }))
  })
