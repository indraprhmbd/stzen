# Agnostic Expiry Reminders (provider-port notification system)

Date: 2026-09-13. Status: planned, implementing GCal as provider #1.

## Goal
Remind admin of credential expiry via external channels. First channel:
Google Calendar event per paid order. Design stays provider-agnostic so
WhatsApp/email/webhook plug in later without touching order flow.

## Non-goals
No customer-facing notifications. No cron daemon (event-driven on state
transitions; backfill is a manual admin click). No new DB tables.

## Architecture: port + adapters in shared kernel
`server/shared/lib/notify/` is kernel (like errors/middleware), not a
feature module. Feature modules import shared only, so `orders.service`
can emit events without importing any provider module.

```
shared/lib/notify/
  notify.types.ts      ReminderEvent, OrderReminderFacts, NotifyResult,
                       NotificationProvider interface
  expiry.ts            pure computeExpiry(paidAt, value, unit) -> Date|null
  notify.dispatcher.ts provider registry (Map, idempotent) + fan-out
                       dispatchReminder(event, facts): never throws,
                       per-provider try/catch, returns NotifyResult[]
  providers/
    gcal.provider.ts   Google Calendar adapter (jose RS256 + raw fetch)

modules/reminders/
  reminders.types.ts   PreviewRow, BackfillResult
  reminders.schema.ts  backfill limit zod schema
  reminders.service.ts scheduleForOrder / cancelForOrder / preview /
                       backfillBatch (uses ordersService.getById +
                       dispatcher; cross-module via service, per rule 2)
  reminders.routes.ts  GET /preview, POST /backfill (admin only)
  index.ts             routes + service re-exports
```

`app.ts` composes: `registerProvider(gcalProvider)` + mount
`adminRoutes.route('/reminders', reminderRoutes)` (inherits requireRole
admin + conceal, same pattern as danger module).

## Port contract
```ts
interface NotificationProvider {
  name: string                              // 'gcal'
  isEnabled(): Promise<boolean>             // settings + secrets present
  schedule(f: OrderReminderFacts, e: Date): Promise<NotifyResult>
  cancel(orderPublicId: string): Promise<NotifyResult>
}
```
Adding a provider = new file implementing 3 methods + one
`registerProvider` line. Dispatcher fans out to every enabled provider;
one provider failing never blocks others or the order flow.

## Expiry math (single source of truth: expiry.ts)
- Anchor: `paid_at`. (No `delivered_at` column exists; delivery needs no
  extra event since PAID already scheduled one.)
- Term: order snapshots `duration_snapshot` + `duration_snapshot_unit`
  (day/week/month). Null duration = no expiry = skip silently.
- Month = calendar month via `setMonth` (not 30 days), matching how
  subscriptions are sold. Pure function, unit-tested.

## Event lifecycle
- `order.paid` (transitionStatus->PAID, claimPaid webhook): schedule on
  all enabled providers. Awaited inside service with 5s abort timeout;
  token cached in isolate memory so steady state = 1 Google fetch.
  Failure path: appendAudit + swallow, order transition already committed.
- `order.cancelled` (REFUNDED/REJECTED): cancel on all providers.
- DELIVERED: noop (event exists from PAID).
- GCal idempotency: `extendedProperties.private.stzenOrder = publicId`.
  Schedule is insert-only (PAID happens once per order by state machine).
  Cancel lists with `privateExtendedProperty` filter then deletes; no
  migration, no new column.

## Settings (ops.*) + secrets
- `ops.notify_providers` csv, default `''` (feature off until admin opts
  in). `ops.gcal_calendar_id` (admin calendar mail, non-secret).
  `ops.gcal_remind_days` int 0-14 default 3 (popup T-days + day-of).
- Secret: `GCAL_SA_JSON` (whole service-account JSON incl. PEM).
- `wrangler.jsonc` gains `NOTIFY_PROVIDERS` var per env (`''` prod,
  `'gcal'` staging when we stage it). `check-secrets.mjs` requires
  `GCAL_SA_JSON` only when the env var lists gcal (same provider-aware
  pattern as payments). SA JSON never touches git or wrangler vars.

## Cost / quota (Sep 2026 facts)
- Calendar API: standard use free under 1M req/day/project; billing for
  overage only planned later 2026 with 90-day notice. Traffic here is
  ~2 req/order + rare token refresh: 4 orders of magnitude below.
- Workers free: no cron trigger spent (0 of 5). Per transition 1-2
  subrequests (token cached), under 50 cap. jose already a dependency:
  zero new deps, bundle unchanged in practice.

## Verification
- `tsx --test` additions: expiry math (month edge: Jan 31 + 1mo),
  dispatcher fan-out (stub providers, one throws -> others still run),
  gcal payload mapping (stub fetch asserts calendarId, summary,
  extendedProperties, reminders array).
- Standard gate: server tsc, server tests, client tsc + build (Settings
  LABELS only), workers dry-run --env staging, lint-migrations (none).
- Staging smoke: manual order approve -> event in admin calendar with
  popup; refund -> event deleted; Settings Operasional group shows the
  three new keys.

## Manual setup (one time, ~10 min)
1. GCP project -> enable Calendar API -> service account -> JSON key.
2. Calendar Settings -> share with SA email as writer -> copy calendar ID.
3. `wrangler secret put GCAL_SA_JSON --env staging`, set the three
   ops.* keys in Settings, done. Prod repeats when ready.
