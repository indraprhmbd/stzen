import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { appendAudit } from '../../shared/lib/audit'
import { getSetting, invalidateSettings } from '../../shared/lib/settings'

type SettingsEnv = AuthEnv

// Public storefront surface. Allowlist only: payment keys and ops keys must
// never leave the server. Response shape is consumed by usePublicSettings
// ({ announcement, storeName, whatsapp, telegram, email }).
const PUBLIC_KEYS = [
  'store.name',
  'store.announcement',
  'support.whatsapp',
  'support.telegram',
  'support.email',
] as const

const KNOWN_KEYS = [
  'store.name',
  'store.announcement',
  'support.whatsapp',
  'support.telegram',
  'support.email',
  'payment.bank_name',
  'payment.account_number',
  'payment.account_name',
  'ops.low_threshold',
  'ops.vault_lock_minutes',
  'ops.csv_limit',
  'ops.notify_providers',
  'ops.gcal_calendar_id',
  'ops.gcal_remind_days',
] as const

const INT_KEYS: Record<string, { min: number; max: number }> = {
  'ops.low_threshold': { min: 1, max: 100 },
  'ops.vault_lock_minutes': { min: 1, max: 60 },
  'ops.csv_limit': { min: 100, max: 5000 },
  'ops.gcal_remind_days': { min: 0, max: 14 },
}

const SettingsUpdateSchema = z.object({
  values: z.record(z.string(), z.string().max(500)),
})

export const publicSettingsRoutes = new Hono()
  .get('/', async (c) => {
    // Reads go through the 60s server cache (shared/lib/settings.ts),
    // invalidated on admin PUT. Edge + browser caching via Cache-Control
    // below: payload is allowlisted public data, no user content.
    const [storeName, announcement, whatsapp, telegram, email] = await Promise.all([
      getSetting('store.name', ''),
      getSetting('store.announcement', ''),
      getSetting('support.whatsapp', ''),
      getSetting('support.telegram', ''),
      getSetting('support.email', ''),
    ])

    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=60')
    c.header('Cache-Tag', 'settings')
    return c.json({ storeName, announcement, whatsapp, telegram, email })
  })

export const adminSettingsRoutes = new Hono<SettingsEnv>()

  .get('/', async (c) => {
    const { data: rows, error } = await supabaseAdmin
      .from('settings')
      .select('key, value')

    if (error) throw new Error(error.message)

    const values: Record<string, string> = {}
    for (const r of rows || []) {
      values[r.key] = r.value
    }

    return c.json({ keys: KNOWN_KEYS, values })
  })

  .put('/', zValidator('json', SettingsUpdateSchema), async (c) => {
    const user = c.get('user')
    const { values } = c.req.valid('json')
    const allowed = new Set<string>(KNOWN_KEYS as unknown as string[])
    const entries = Object.entries(values).filter(([k]) => allowed.has(k))

    for (const [k, v] of entries) {
      const rule = INT_KEYS[k]
      if (rule) {
        const n = parseInt(v, 10)
        if (!Number.isFinite(n) || n < rule.min || n > rule.max) {
          return c.json({ error: `${k} must be an integer ${rule.min}-${rule.max}` }, 400)
        }
      }

      const { error } = await supabaseAdmin
        .from('settings')
        .upsert({ key: k, value: v, updated_at: new Date().toISOString() })

      if (error) throw new Error(error.message)
    }

    invalidateSettings()
    await appendAudit({
      action: 'settings:update',
      resourceType: 'settings',
      resourceName: entries.map(([k]) => k).join(', '),
      snapshotText: `Pengaturan diperbarui oleh ${user.email ?? user.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: user.sub,
      actorEmail: user.email ?? null,
      actorType: 'admin',
      diff: { keys: entries.map(([k]) => k) },
    }).catch(() => {})

    return c.json({ success: true, updated: entries.length })
  })
