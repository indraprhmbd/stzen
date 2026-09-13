// ─── Reminders routes (admin) ───────────────────────────────────────────
// Thin handlers: stateful preview + per-row toggle + bulk. Mounted under
// /api/v1/admin, so requireRole('admin') + conceal come from the composer.

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { type AuthEnv } from '../../shared/middleware/auth'
import { remindersService, type PreviewSort } from './reminders.service'
import { BulkSchema } from './reminders.schema'

const SORTS: PreviewSort[] = ['paidAt', 'product', 'expiry']

export const reminderRoutes = new Hono<AuthEnv>()
  .get('/preview', async (c) => {
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') ?? '10', 10) || 10))
    const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0)
    const rawSort = c.req.query('sort')
    const sort: PreviewSort | null = SORTS.includes(rawSort as PreviewSort) ? (rawSort as PreviewSort) : null
    const sortDir = c.req.query('sortDir') === 'asc' ? 'asc' : 'desc'
    const rawState = c.req.query('state')
    const state = rawState === 'scheduled' || rawState === 'none' ? rawState : 'all'
    const q = (c.req.query('q') ?? '').slice(0, 64)
    return c.json(await remindersService.preview({ limit, offset, sort, sortDir, state, q }))
  })
  .post('/:id/schedule', async (c) => {
    return c.json(await remindersService.scheduleOne(c.req.param('id')))
  })
  .post('/:id/cancel', async (c) => {
    return c.json(await remindersService.cancelOne(c.req.param('id')))
  })
  .post('/bulk', zValidator('json', BulkSchema), async (c) => {
    const { ids, action } = c.req.valid('json')
    return c.json(await remindersService.bulk(ids, action))
  })
