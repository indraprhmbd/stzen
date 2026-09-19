// ─── Notify port tests ──────────────────────────────────────────────────
// Pure expiry math, dispatcher fan-out isolation, gcal payload mapping.
// No network, no DB: provider tests stub fetch + inject config overrides.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPair, exportPKCS8 } from 'jose'
import { computeExpiry } from '../expiry'
import {
  dispatchReminder,
  registerProvider,
} from '../notify.dispatcher'
import type {
  NotificationProvider,
  NotifyResult,
  OrderReminderFacts,
} from '../notify.types'
import { buildEventBody, clearTokenCache, GcalProvider } from '../providers/gcal.provider'

const facts: OrderReminderFacts = {
  publicId: 'STZ-1',
  productName: 'Netflix',
  variantName: 'N-001',
  amount: '50000',
  paidAt: '2026-09-01T00:00:00.000Z',
  durationValue: 1,
  durationUnit: 'month',
}

describe('computeExpiry', () => {
  it('adds calendar months (Jan 31 + 1mo -> Mar 2/3, not Feb 31)', () => {
    const e = computeExpiry('2026-01-31T00:00:00.000Z', 1, 'month')
    assert.ok(e)
    assert.equal(e!.getUTCFullYear(), 2026)
    assert.equal(e!.getUTCMonth(), 2) // March: setMonth overflow, never NaN
  })

  it('handles day and week units', () => {
    assert.equal(
      computeExpiry('2026-09-01T00:00:00.000Z', 7, 'day')!.toISOString(),
      '2026-09-08T00:00:00.000Z',
    )
    assert.equal(
      computeExpiry('2026-09-01T00:00:00.000Z', 2, 'week')!.toISOString(),
      '2026-09-15T00:00:00.000Z',
    )
  })

  it('returns null for missing/invalid input', () => {
    assert.equal(computeExpiry(null, 1, 'month'), null)
    assert.equal(computeExpiry('2026-09-01T00:00:00.000Z', null, 'month'), null)
    assert.equal(computeExpiry('2026-09-01T00:00:00.000Z', 1, null), null)
    assert.equal(computeExpiry('2026-09-01T00:00:00.000Z', 0, 'month'), null)
    assert.equal(computeExpiry('2026-09-01T00:00:00.000Z', 1, 'year'), null)
    assert.equal(computeExpiry('not-a-date', 1, 'month'), null)
  })
})

describe('dispatchReminder', () => {
  function stub(name: string, opts: { enabled?: boolean; fail?: boolean } = {}): NotificationProvider & {
    calls: string[]
  } {
    const calls: string[] = []
    return {
      calls,
      name,
      async isEnabled() {
        return opts.enabled ?? true
      },
      async schedule(f, _e): Promise<NotifyResult> {
        calls.push(`schedule:${f.publicId}`)
        if (opts.fail) throw new Error(`${name} down`)
        return { provider: name, event: 'order.paid', ok: true, externalId: `${name}-1` }
      },
      async cancel(id): Promise<NotifyResult> {
        calls.push(`cancel:${id}`)
        return { provider: name, event: 'order.cancelled', ok: true }
      },
    }
  }

  it('fans out to all enabled providers, skips disabled', async () => {
    const a = stub('test-a')
    const b = stub('test-b', { enabled: false })
    registerProvider(a)
    registerProvider(b)
    const res = await dispatchReminder('order.paid', facts)
    assert.ok(res.some((r) => r.provider === 'test-a' && r.ok))
    assert.ok(!res.some((r) => r.provider === 'test-b'))
    assert.deepEqual(a.calls, ['schedule:STZ-1'])
  })

  it('isolates provider failure, skips schedule when no expiry', async () => {
    const bad = stub('test-bad', { fail: true })
    registerProvider(bad)
    const res = await dispatchReminder('order.paid', facts)
    const row = res.find((r) => r.provider === 'test-bad')
    assert.ok(row && !row.ok && row.error?.includes('down'))

    const noExpiry = await dispatchReminder('order.paid', { ...facts, durationValue: null })
    assert.ok(!noExpiry.some((r) => r.provider === 'test-bad'))
    assert.equal(bad.calls.length, 1) // only the earlier failing schedule, no second call
  })

  it('routes order.cancelled to cancel()', async () => {
    const c = stub('test-c')
    registerProvider(c)
    await dispatchReminder('order.cancelled', facts)
    assert.ok(c.calls.includes('cancel:STZ-1'))
  })
})

describe('gcal buildEventBody', () => {
  it('builds an all-day event with idempotency key + reminders', () => {
    const body = buildEventBody(facts, new Date('2026-10-01T00:00:00.000Z'), 3)
    assert.equal(body.summary, 'STZEN Netflix kadaluarsa')
    assert.deepEqual(body.start, { date: '2026-10-01', timeZone: 'Asia/Jakarta' })
    assert.deepEqual(body.end, { date: '2026-10-02', timeZone: 'Asia/Jakarta' })
    assert.deepEqual(body.extendedProperties, { private: { stzenOrder: 'STZ-1' } })
    const desc = body.description as string
    assert.ok(desc.includes('Order: STZ-1'))
    assert.ok(desc.includes('SKU: N-001'))
    assert.ok(desc.includes('Durasi: 1 bulan (dibayar 01 Sep 2026)'))
    assert.ok(desc.includes('Nominal: Rp50.000'))
    assert.ok(desc.includes('Dikelola otomatis'))
    const withLink = buildEventBody(facts, new Date('2026-10-01T00:00:00.000Z'), 3, 'https://dev.stzen.web.id')
    assert.ok((withLink.description as string).includes('Tautan admin: https://dev.stzen.web.id/admin/orders?status=semua&q=STZ-1'))
    const reminders = body.reminders as { useDefault: boolean; overrides: { method: string; minutes: number }[] }
    assert.equal(reminders.useDefault, false)
    assert.deepEqual(reminders.overrides, [
      { method: 'popup', minutes: 3 * 24 * 60 },
      { method: 'popup', minutes: 12 * 60 },
    ])
    assert.ok((body.description as string).includes('STZ-1'))
  })

  it('dates the event in WIB: 20 Sep 18:00 UTC is already 21 Sep in Jakarta', () => {
    const body = buildEventBody(facts, new Date('2026-09-20T18:00:00.000Z'), 3)
    assert.deepEqual(body.start, { date: '2026-09-21', timeZone: 'Asia/Jakarta' })
    assert.deepEqual(body.end, { date: '2026-09-22', timeZone: 'Asia/Jakarta' })
  })

  it('omits the T-days reminder when remindDays is 0', () => {
    const body = buildEventBody(facts, new Date('2026-10-01T00:00:00.000Z'), 0)
    const reminders = body.reminders as { overrides: unknown[] }
    assert.equal(reminders.overrides.length, 1)
  })

  it('colors the event tomato and links source to the admin order when base url set', () => {
    const body = buildEventBody(facts, new Date('2026-10-01T00:00:00.000Z'), 3, 'https://dev.stzen.web.id')
    assert.equal(body.colorId, '11')
    assert.deepEqual(body.source, {
      title: 'STZEN Admin',
      url: 'https://dev.stzen.web.id/admin/orders?status=semua&q=STZ-1',
    })
    const noLink = buildEventBody(facts, new Date('2026-10-01T00:00:00.000Z'), 3)
    assert.equal(noLink.source, undefined)
  })
})

describe('gcal provider with stub fetch', () => {
  let saJson: string

  beforeEach(async () => {
    clearTokenCache()
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    const pem = await exportPKCS8(privateKey)
    saJson = JSON.stringify({ client_email: 'sa@test.iam.gserviceaccount.com', private_key: pem })
    process.env.GCAL_SA_JSON = saJson
  })

  function stubFetch(calls: { url: string; init?: unknown }[]) {
    return (async (url: unknown, init?: unknown) => {
      calls.push({ url: String(url), init })
      const u = String(url)
      if (u.includes('oauth2.googleapis.com/token')) {
        return Response.json({ access_token: 'tok', expires_in: 3600 })
      }
      if (u.includes('/events?')) {
        return Response.json({ items: [{ id: 'evt-9' }] })
      }
      if ((init as RequestInit)?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return Response.json({ id: 'evt-1' })
    }) as typeof fetch
  }

  it('schedule() exchanges token once then inserts', async () => {
    const calls: { url: string; init?: unknown }[] = []
    const p = new GcalProvider(stubFetch(calls), { calendarId: 'admin@gmail.com', remindDays: 3 })
    const res = await p.schedule(facts, new Date('2026-10-01T00:00:00.000Z'))
    assert.equal(res.ok, true)
    assert.equal(res.externalId, 'admin@gmail.com=evt-1')
    const insert = calls.find((c) => c.url.includes('/events') && !c.url.includes('oauth2'))
    assert.ok(insert)
    const body = JSON.parse((insert!.init as RequestInit).body as string)
    assert.equal(body.summary, 'STZEN Netflix kadaluarsa')
    const auth = ((insert!.init as RequestInit).headers as Record<string, string>).Authorization
    assert.equal(auth, 'Bearer tok')
  })

  it('schedule() fans out one insert per admin calendar', async () => {
    const calls: { url: string; init?: unknown }[] = []
    const p = new GcalProvider(stubFetch(calls), { calendarIds: ['a@gmail.com', 'b@gmail.com'] })
    const res = await p.schedule(facts, new Date('2026-10-01T00:00:00.000Z'))
    assert.equal(res.ok, true)
    const inserts = calls.filter((c) => (c.init as RequestInit)?.method === 'POST' && c.url.includes('/calendars/'))
    assert.equal(inserts.length, 2)
    assert.ok(inserts[0]!.url.includes(encodeURIComponent('a@gmail.com')))
    assert.ok(inserts[1]!.url.includes(encodeURIComponent('b@gmail.com')))
    // Token exchanged once for the whole fan-out, not per calendar.
    assert.equal(calls.filter((c) => c.url.includes('oauth2.googleapis.com/token')).length, 1)
    assert.ok(res.externalId?.includes('a@gmail.com=evt-1'))
  })

  it('schedule() reports partial failure but stays ok', async () => {
    const calls: { url: string; init?: unknown }[] = []
    const fetchImpl = (async (url: unknown, init?: unknown) => {
      calls.push({ url: String(url), init })
      const u = String(url)
      if (u.includes('oauth2.googleapis.com/token')) return Response.json({ access_token: 'tok' })
      if (u.includes(encodeURIComponent('gone@gmail.com'))) return new Response('gone', { status: 404 })
      return Response.json({ id: 'evt-1' })
    }) as typeof fetch
    const p = new GcalProvider(fetchImpl, { calendarIds: ['ok@gmail.com', 'gone@gmail.com'] })
    const res = await p.schedule(facts, new Date('2026-10-01T00:00:00.000Z'))
    assert.equal(res.ok, true)
    assert.ok(res.externalId?.includes('ok@gmail.com=evt-1'))
    assert.ok(res.error?.includes('gone@gmail.com'))
  })

  it('cancel() lists by idempotency key then deletes', async () => {
    const calls: { url: string; init?: unknown }[] = []
    const p = new GcalProvider(stubFetch(calls), { calendarId: 'admin@gmail.com' })
    const res = await p.cancel('STZ-1')
    assert.equal(res.ok, true)
    assert.ok(calls.some((c) => c.url.includes('privateExtendedProperty') && c.url.includes('stzenOrder%3DSTZ-1')))
    assert.ok(calls.some((c) => (c.init as RequestInit)?.method === 'DELETE'))
  })

  it('cancel() fans out across calendars', async () => {
    const calls: { url: string; init?: unknown }[] = []
    const p = new GcalProvider(stubFetch(calls), { calendarIds: ['a@gmail.com', 'b@gmail.com'] })
    const res = await p.cancel('STZ-1')
    assert.equal(res.ok, true)
    const lists = calls.filter((c) => c.url.includes('/events?'))
    assert.equal(lists.length, 2)
    assert.equal(calls.filter((c) => (c.init as RequestInit)?.method === 'DELETE').length, 2)
  })

  it('overrides.enabled=false short-circuits isEnabled', async () => {
    const p = new GcalProvider(stubFetch([]), { enabled: false })
    assert.equal(await p.isEnabled(), false)
  })
})
