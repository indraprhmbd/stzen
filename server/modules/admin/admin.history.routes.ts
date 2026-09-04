import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'

type HistoryEnv = AuthEnv

export const adminHistoryRoutes = new Hono<HistoryEnv>()

// Auth is enforced globally in app.ts; this only adds the role check.
adminHistoryRoutes.use('*', requireRole('admin'))

// GET / — list audit logs with filters
adminHistoryRoutes.get('/', async (c) => {
  const type = c.req.query('type') // order, stock, all
  const q = c.req.query('q')
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
  const offset = parseInt(c.req.query('offset') || '0', 10)

  const conditions: any[] = []
  if (type && type !== 'all') conditions.push(sql`resource_type = ${type}`)
  if (q) conditions.push(sql`(resource_public_id ilike ${'%' + q + '%'} or snapshot_text ilike ${'%' + q + '%'} or actor_email ilike ${'%' + q + '%'})`)

  const where = conditions.length ? sql`where ${sql.join(conditions, sql` and `)}` : sql``

  const rows = await db.execute(sql`
    select id, created_at, actor_email, action, resource_type, resource_public_id, resource_name, snapshot_text
    from audit_logs
    ${where}
    order by created_at desc
    limit ${limit} offset ${offset}
  `) as unknown as any[]

  const countRes = await db.execute(sql`
    select count(*)::int as total from audit_logs ${where}
  `) as unknown as any[]

  const total = (countRes as any)[0]?.total ?? (countRes as any).rows?.[0]?.total ?? 0

  // drizzle execute returns different shape depending on driver, normalize
  const data = Array.isArray(rows) ? rows : (rows as any).rows ?? rows
  const t = Array.isArray(countRes) ? (countRes[0] as any)?.total : (countRes as any).rows?.[0]?.total
  return c.json({ data, total: t ?? 0 })
})
