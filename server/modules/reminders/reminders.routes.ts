// ─── Reminders routes (admin) ───────────────────────────────────────────
// Thin handlers: preview + manual backfill. Mounted under /api/v1/admin,
// so requireRole('admin') + conceal come from the admin composer.

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { type AuthEnv } from '../../shared/middleware/auth'
import { remindersService } from './reminders.service'
import { BackfillSchema } from './reminders.schema'

export const reminderRoutes = new Hono<AuthEnv>()
  .get('/preview', async (c) => {
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
    return c.json({ rows: await remindersService.preview(limit) })
  })
  .post('/backfill', zValidator('json', BackfillSchema), async (c) => {
    const { limit } = c.req.valid('json')
    return c.json(await remindersService.backfill(limit))
  })
