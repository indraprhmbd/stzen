import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { appendAudit } from '../../shared/lib/audit'

// ─── Admin Settings Routes ────────────────────────────────────────────────────
// Key/value store for bank accounts and support contacts (no RLS row, superuser only).

type SettingsEnv = AuthEnv

const KNOWN_KEYS = [
  'support.whatsapp',
  'support.telegram',
  'support.email',
  'payment.bank_name',
  'payment.account_number',
  'payment.account_name',
] as const

const SettingsUpdateSchema = z.object({
  values: z.record(z.string(), z.string().max(500)),
})

export const adminSettingsRoutes = new Hono<SettingsEnv>()
  // Auth is enforced globally in app.ts; this only adds the role check.
  .use('*', requireRole('admin'))

// GET / — All settings as object plus key metadata
  .get('/', async (c) => {
  const rows = (await db.execute(sql`select key, value from settings`)) as unknown as any
  const list: { key: string; value: string }[] = Array.isArray(rows) ? rows : rows?.rows ?? []
  const values: Record<string, string> = {}
  for (const r of list) values[r.key] = r.value
  return c.json({ keys: KNOWN_KEYS, values })
})

// PUT / — Upsert known keys only
  .put('/', zValidator('json', SettingsUpdateSchema), async (c) => {
  const user = c.get('user')
  const { values } = c.req.valid('json')
  const allowed = new Set<string>(KNOWN_KEYS as unknown as string[])
  const entries = Object.entries(values).filter(([k]) => allowed.has(k))
  for (const [k, v] of entries) {
    await db.execute(sql`
      insert into settings (key, value, updated_at) values (${k}, ${v}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `)
  }
  await appendAudit({
    action: 'settings:update',
    resourceType: 'settings',
    resourceName: entries.map(([k]) => k).join(', '),
    snapshotText: `Pengaturan diperbarui oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
    actorId: user.sub,
    actorEmail: user.email ?? null,
    actorType: 'admin',
    diff: Object.fromEntries(entries),
  }).catch(() => {})
  return c.json({ success: true, updated: entries.length })
})
