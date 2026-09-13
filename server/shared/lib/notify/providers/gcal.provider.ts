// ─── Google Calendar provider ───────────────────────────────────────────
// NotificationProvider #1: inserts an all-day expiry event into each
// configured admin calendar (every address in ops.gcal_calendar_id must
// share its calendar with the service account as writer).
// Auth: service-account JWT bearer via jose (already a dependency) + raw
// fetch. No googleapis lib: Node-only deps + 3MB Worker bundle cap.
// Secrets: GCAL_SA_JSON (whole SA JSON). Non-secrets: ops.* settings.

import { SignJWT, importPKCS8 } from 'jose'
import { getEnv } from '../../runtime-env'
import { getIntSetting, getSetting } from '../../settings'
import { toJakartaDate } from '../expiry'
import type {
  NotificationProvider,
  NotifyResult,
  OrderReminderFacts,
} from '../notify.types'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const TIMEOUT_MS = 5000

interface ServiceAccountJson {
  client_email: string
  private_key: string
  private_key_id?: string
}

function withTimeout(): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  return { signal: ctrl.signal, cleanup: () => clearTimeout(timer) }
}

function loadServiceAccount(): ServiceAccountJson | null {
  const raw = getEnv('GCAL_SA_JSON')
  if (!raw) return null
  try {
    const sa = JSON.parse(raw) as ServiceAccountJson
    if (!sa.client_email || !sa.private_key) return null
    // wrangler secret put often stores literal \n escapes.
    sa.private_key = sa.private_key.replace(/\\n/g, '\n')
    return sa
  } catch {
    return null
  }
}

// Isolate-memory token cache: one token fetch per hour per isolate, so the
// steady-state cost of a transition is a single Calendar API call.
let cachedToken: { token: string; exp: number } | null = null

async function getAccessToken(
  sa: ServiceAccountJson,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token

  const key = await importPKCS8(sa.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  const assertion = await new SignJWT({
    iss: sa.client_email,
    sub: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id })
    .sign(key)

  const { signal, cleanup } = withTimeout()
  try {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal,
    })
    if (!res.ok) throw new Error(`token exchange ${res.status}`)
    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) throw new Error('token exchange: no access_token')
    cachedToken = {
      token: data.access_token,
      exp: Date.now() + (data.expires_in ?? 3600) * 1000,
    }
    return cachedToken.token
  } finally {
    cleanup()
  }
}

export function clearTokenCache(): void {
  cachedToken = null
}

function toISODate(d: Date): string {
  return toJakartaDate(d)
}

// Pure payload builder: unit-tested without network.
export function buildEventBody(
  facts: OrderReminderFacts,
  expiry: Date,
  remindDays: number,
): Record<string, unknown> {
  const day = toISODate(expiry)
  const next = new Date(expiry.getTime() + 24 * 3600 * 1000)
  const overrides = [{ method: 'popup', minutes: 12 * 60 }]
  if (remindDays > 0) overrides.unshift({ method: 'popup', minutes: remindDays * 24 * 60 })
  return {
    summary: `STZEN ${facts.productName} kadaluarsa`,
    description: [
      `Order ${facts.publicId}`,
      facts.variantName ? `Varian ${facts.variantName}` : null,
      `Nominal Rp${facts.amount}`,
      facts.customerEmail ? `Pelanggan ${facts.customerEmail}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    start: { date: day, timeZone: 'Asia/Jakarta' },
    end: { date: toISODate(next), timeZone: 'Asia/Jakarta' },
    extendedProperties: { private: { stzenOrder: facts.publicId } },
    reminders: { useDefault: false, overrides },
  }
}

async function providersCsv(): Promise<string[]> {
  const raw = await getSetting('ops.notify_providers', '')
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export interface GcalConfigOverrides {
  /** Test seam: skip settings + secret store. */
  enabled?: boolean
  /** Single address (legacy) or csv; normalized to a list. */
  calendarId?: string
  calendarIds?: string[]
  remindDays?: number
}

function parseCalendarIds(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export class GcalProvider implements NotificationProvider {
  readonly name = 'gcal'
  private fetchImpl: typeof fetch
  private overrides: GcalConfigOverrides

  constructor(fetchImpl: typeof fetch = (...a) => fetch(...a), overrides: GcalConfigOverrides = {}) {
    this.fetchImpl = fetchImpl
    this.overrides = overrides
  }

  private async resolveConfig(): Promise<{ calendarIds: string[]; remindDays: number }> {
    if (this.overrides.calendarId || this.overrides.calendarIds) {
      const ids = this.overrides.calendarIds ?? parseCalendarIds(this.overrides.calendarId ?? '')
      return { calendarIds: ids, remindDays: this.overrides.remindDays ?? 3 }
    }
    return {
      calendarIds: parseCalendarIds(await getSetting('ops.gcal_calendar_id', '')),
      remindDays: await getIntSetting('ops.gcal_remind_days', 3, 0, 14),
    }
  }

  async isEnabled(): Promise<boolean> {
    if (this.overrides.enabled !== undefined) return this.overrides.enabled
    const providers = await providersCsv()
    if (!providers.includes('gcal')) return false
    if (!loadServiceAccount()) return false
    const { calendarIds } = await this.resolveConfig()
    return calendarIds.length > 0
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const sa = loadServiceAccount()
    if (!sa) throw new Error('GCAL_SA_JSON missing or invalid')
    const token = await getAccessToken(sa, this.fetchImpl)
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  async schedule(facts: OrderReminderFacts, expiry: Date): Promise<NotifyResult> {
    const { calendarIds, remindDays } = await this.resolveConfig()
    if (calendarIds.length === 0) throw new Error('ops.gcal_calendar_id not set')
    const headers = await this.authHeaders()
    const body = JSON.stringify(buildEventBody(facts, expiry, remindDays))
    const ids: string[] = []
    const failures: string[] = []
    // Sequential fan-out: one insert per admin calendar. Token is cached so
    // each calendar costs exactly 1 subrequest (3 admins = 3 calls).
    for (const calendarId of calendarIds) {
      const { signal, cleanup } = withTimeout()
      try {
        const res = await this.fetchImpl(
          `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
          { method: 'POST', headers, body, signal },
        )
        if (!res.ok) {
          failures.push(`${calendarId}: events.insert ${res.status}`)
          continue
        }
        const data = (await res.json()) as { id?: string }
        if (data.id) ids.push(`${calendarId}=${data.id}`)
      } finally {
        cleanup()
      }
    }
    if (ids.length === 0) throw new Error(`events.insert failed: ${failures.join('; ')}`)
    if (failures.length > 0) {
      // Partial: event lives on some calendars. Report ok (state flips to
      // scheduled) but surface which calendar failed for the audit trail.
      return { provider: this.name, event: 'order.paid', ok: true, externalId: ids.join(','), error: `partial: ${failures.join('; ')}` }
    }
    return { provider: this.name, event: 'order.paid', ok: true, externalId: ids.join(',') }
  }

  async cancel(orderPublicId: string): Promise<NotifyResult> {
    const { calendarIds } = await this.resolveConfig()
    if (calendarIds.length === 0) throw new Error('ops.gcal_calendar_id not set')
    const headers = await this.authHeaders()
    const q = new URLSearchParams({
      privateExtendedProperty: `stzenOrder=${orderPublicId}`,
      maxResults: '10',
      singleEvents: 'true',
    })
    const failures: string[] = []
    for (const calendarId of calendarIds) {
      const { signal, cleanup } = withTimeout()
      try {
        const list = await this.fetchImpl(
          `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
          { headers, signal },
        )
        if (!list.ok) {
          failures.push(`${calendarId}: events.list ${list.status}`)
          continue
        }
        const data = (await list.json()) as { items?: { id?: string }[] }
        for (const item of data.items ?? []) {
          if (!item.id) continue
          const del = await this.fetchImpl(
            `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(item.id)}`,
            { method: 'DELETE', headers, signal },
          )
          if (!del.ok && del.status !== 404 && del.status !== 410) {
            failures.push(`${calendarId}: events.delete ${del.status}`)
          }
        }
      } finally {
        cleanup()
      }
    }
    if (failures.length > 0) throw new Error(`cancel failed: ${failures.join('; ')}`)
    return { provider: this.name, event: 'order.cancelled', ok: true }
  }
}

export const gcalProvider = new GcalProvider()
