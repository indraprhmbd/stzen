// ─── Reminder dispatch auditing ─────────────────────────────────────────
// Shared so both orders.service (transition hooks) and reminders.service
// (backfill) record provider failures identically. Best-effort: never throws.

import { appendAudit } from '../audit'
import type { NotifyResult, ReminderEvent } from './notify.types'

export async function auditDispatchResults(
  event: ReminderEvent,
  publicId: string,
  results: NotifyResult[],
  actorType: 'admin' | 'system' = 'system',
): Promise<void> {
  const failures = results.filter((r) => !r.ok)
  if (failures.length === 0) return
  const detail = failures.map((r) => `${r.provider}: ${r.error ?? 'unknown'}`).join('; ')
  await appendAudit({
    action: event === 'order.paid' ? 'reminder:schedule' : 'reminder:cancel',
    resourceType: 'order',
    resourcePublicId: publicId,
    snapshotText: `Pengingat ${event} gagal untuk order ${publicId}: ${detail}`,
    actorType,
    diff: { event, failures: failures.map((r) => r.provider) },
  }).catch(() => {})
}
