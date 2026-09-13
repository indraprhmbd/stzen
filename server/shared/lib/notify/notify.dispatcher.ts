// ─── Notify dispatcher ──────────────────────────────────────────────────
// Fan-out over registered providers. Never throws: each provider is
// individually guarded so one broken channel cannot block others or the
// order flow. Registration is a Map set -> idempotent, safe to call from
// createApp() on every isolate boot.

import type {
  NotificationProvider,
  NotifyResult,
  OrderReminderFacts,
  ReminderEvent,
} from './notify.types'
import { computeExpiry } from './expiry'

const registry = new Map<string, NotificationProvider>()

export function registerProvider(provider: NotificationProvider): void {
  registry.set(provider.name, provider)
}

export function registeredProviders(): string[] {
  return [...registry.keys()]
}

export async function dispatchReminder(
  event: ReminderEvent,
  facts: OrderReminderFacts,
): Promise<NotifyResult[]> {
  const results: NotifyResult[] = []
  for (const provider of registry.values()) {
    try {
      if (!(await provider.isEnabled())) continue
    } catch (err) {
      results.push({
        provider: provider.name,
        event,
        ok: false,
        error: err instanceof Error ? err.message : 'isEnabled failed',
      })
      continue
    }
    try {
      if (event === 'order.paid') {
        const expiry = computeExpiry(facts.paidAt, facts.durationValue, facts.durationUnit)
        // No expiry (e.g. lifetime/no-duration product): nothing to remind.
        if (!expiry) continue
        results.push(await provider.schedule(facts, expiry))
      } else {
        results.push(await provider.cancel(facts.publicId))
      }
    } catch (err) {
      results.push({
        provider: provider.name,
        event,
        ok: false,
        error: err instanceof Error ? err.message : 'provider failed',
      })
    }
  }
  return results
}
