import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'

const AUDIT_LOGS = 'audit_logs'

type HistoryEnv = AuthEnv

export const adminHistoryRoutes = new Hono<HistoryEnv>()

  .get('/', zValidator('query', z.object({
    type: z.string().optional(),
    actor: z.enum(['admin', 'user', 'system']).optional(),
    q: z.string().optional(),
    // Exact order/product public id for per-row timelines (Riwayat dialog).
    resource: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
    sort: z.string().optional(),
    sortDir: z.string().optional(),
  })), async (c) => {
    const type = c.req.query('type')
    const actor = c.req.query('actor')
    const q = c.req.query('q')
    const resource = c.req.query('resource')
    const { limit, offset } = c.req.valid('query')
    const sort = c.req.query('sort') || 'created_at'
    const sortDir = c.req.query('sortDir') || 'desc'

    let query = supabaseAdmin.from(AUDIT_LOGS).select('*')

    if (type && type !== 'all') {
      query = query.eq('resource_type', type)
    }
    if (actor) {
      query = query.eq('actor_type', actor)
    }
    if (q) {
      const like = `%${q}%`
      query = query.or(`resource_public_id.ilike.${like},snapshot_text.ilike.${like},actor_email.ilike.${like}`)
    }
    if (resource) {
      query = query.eq('resource_public_id', resource)
    }

    if (sort === 'action') {
      query = query.order('action', { ascending: sortDir === 'asc' })
    } else {
      query = query.order('created_at', { ascending: sortDir === 'asc' })
    }

    const { data: rows, error } = await query.range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)

    // estimated: audit_logs grows forever by design; exact COUNT would scan
    // the whole table on every page view. Exact under db-max-rows anyway.
    let countQuery = supabaseAdmin.from(AUDIT_LOGS).select('*', { count: 'estimated', head: true })
    if (type && type !== 'all') {
      countQuery = countQuery.eq('resource_type', type)
    }
    if (actor) {
      countQuery = countQuery.eq('actor_type', actor)
    }
    if (q) {
      const like = `%${q}%`
      countQuery = countQuery.or(`resource_public_id.ilike.${like},snapshot_text.ilike.${like},actor_email.ilike.${like}`)
    }
    if (resource) {
      countQuery = countQuery.eq('resource_public_id', resource)
    }

    const { count } = await countQuery

    return c.json({
      data: rows || [],
      total: count || 0,
    })
  })
