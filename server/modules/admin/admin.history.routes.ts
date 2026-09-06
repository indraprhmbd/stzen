import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'

type HistoryEnv = AuthEnv

export const adminHistoryRoutes = new Hono<HistoryEnv>()
  // Auth is enforced globally in app.ts; this only adds the role check.
  .use('*', requireRole('admin'))

  // GET / — list audit logs with filters + sort
  .get('/', zValidator('query', z.object({
    type: z.string().optional(),
    actor: z.enum(['admin', 'user', 'system']).optional(),
    q: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
    sort: z.string().optional(),
    sortDir: z.string().optional(),
  })), async (c) => {
  const type = c.req.query('type')
  const actor = c.req.query('actor')
  const q = c.req.query('q')
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
  const offset = parseInt(c.req.query('offset') || '0', 10)
  const sort = c.req.query('sort') || 'createdAt'
  const sortDir = c.req.query('sortDir') || 'desc'

  const conditions: any[] = []
  if (type && type !== 'all') conditions.push(sql`resource_type = ${type}`)
  if (actor) conditions.push(sql`actor_type = ${actor}`)
  if (q) conditions.push(sql`(resource_public_id ilike ${'%' + q + '%'} or snapshot_text ilike ${'%' + q + '%'} or actor_email ilike ${'%' + q + '%'})`)

  const where = conditions.length ? sql`where ${sql.join(conditions, sql` and `)}` : sql``
  // id tiebreak: same-ms rows (bulk import, webhook bursts) keep stable order.
  const orderBy = sort === 'action'
    ? (sortDir === 'asc' ? sql`order by action asc, id asc` : sql`order by action desc, id desc`)
    : (sortDir === 'asc' ? sql`order by created_at asc, id asc` : sql`order by created_at desc, id desc`)

  // Parallelize data + count (2 independent queries)
  const [rows, countRes] = await Promise.all([
    db.execute(sql`
      select id, created_at, actor_email, actor_type, action, resource_type, resource_public_id, resource_name, snapshot_text
      from audit_logs
      ${where}
      ${orderBy}
      limit ${limit} offset ${offset}
    `),
    db.execute(sql`
      select count(*)::int as total from audit_logs ${where}
    `),
  ] as unknown as any[][])

  const data = Array.isArray(rows) ? rows : (rows as any).rows ?? rows
  const total = (Array.isArray(countRes) ? countRes[0] : (countRes as any).rows?.[0])?.total ?? 0
  return c.json({ data, total })
})
