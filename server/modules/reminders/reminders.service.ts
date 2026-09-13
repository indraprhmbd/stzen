// ─── Reminders service ──────────────────────────────────────────────────
// Bridges order state changes to the provider-agnostic notify dispatcher.
// Cross-module reads go through ordersService (rule 2); provider access
// goes through the shared dispatcher, so this module never imports a
// provider file and orders never imports this module (no cycles).
//
// reminder_state is the single writer-owned mirror of Google truth:
// 'scheduled' iff an expiry event exists. Auto-hooks and manual toggles
// share writeState, so the column cannot drift from dispatch results.

import { supabaseAdmin } from '../../shared/db'
import { appendAudit } from '../../shared/lib/audit'
import { BadRequestError } from '../../shared/errors/http'
import { computeExpiry } from '../../shared/lib/notify/expiry'
import { dispatchReminder } from '../../shared/lib/notify/notify.dispatcher'
import { auditDispatchResults } from '../../shared/lib/notify/notify.audit'
import type { OrderReminderFacts } from '../../shared/lib/notify/notify.types'
import { service as ordersService } from '../orders'
import type { BackfillResult, PreviewRow, ReminderState } from './reminders.types'

const ORDERS = 'orders'
const PRODUCT_VARIANTS = 'product_variants'

export type PreviewSort = 'paidAt' | 'product' | 'expiry'

export interface PreviewParams {
  limit: number
  offset: number
  sort: PreviewSort | null
  sortDir: 'asc' | 'desc'
  state: 'all' | ReminderState
  q: string
}

function toFacts(order: {
  id: string
  productName: string
  variantSku: string | null
  amount: string
  paidAt: string | null
  durationValue: number | null
  durationUnit: string | null
}): OrderReminderFacts {
  return {
    publicId: order.id,
    productName: order.productName,
    variantName: order.variantSku,
    amount: order.amount,
    paidAt: order.paidAt,
    durationValue: order.durationValue,
    durationUnit: order.durationUnit,
  }
}

// Duration resolution: order snapshot first, live variant as fallback.
// Snapshots predate older orders (null even for subscription products),
// so without fallback those orders could never get an expiry. Explicit
// null only when neither source has a duration (lifetime products).
// Batched: one variant query for the whole page, never per-row (N+1).
async function batchVariantDurations(
  variantIds: (string | null)[],
): Promise<Map<string, { value: number | null; unit: string | null }>> {
  const ids = [...new Set(variantIds.filter((v): v is string => !!v))]
  const map = new Map<string, { value: number | null; unit: string | null }>()
  if (ids.length === 0) return map
  const { data } = await supabaseAdmin
    .from(PRODUCT_VARIANTS)
    .select('id, duration_months, duration_unit')
    .in('id', ids)
  for (const v of (data ?? []) as any[]) {
    map.set(v.id, {
      value: v.duration_months ?? null,
      unit: v.duration_unit ?? null,
    })
  }
  return map
}

async function writeState(publicId: string, state: ReminderState): Promise<void> {
  const { error } = await supabaseAdmin
    .from(ORDERS)
    .update({
      reminder_state: state,
      reminder_scheduled_at: state === 'scheduled' ? new Date().toISOString() : null,
    })
    .eq('public_id', publicId)
  if (error) throw new Error(error.message)
}

// Resolve facts for one order, applying the live-variant fallback when the
// snapshot is null. Throws BadRequestError when no expiry is computable
// (client disables the toggle with the same reason text).
async function resolveFacts(publicId: string): Promise<{ facts: OrderReminderFacts; reason: string | null }> {
  const order = await ordersService.getById(publicId)
  let value = order.durationValue
  let unit = order.durationUnit
  let source: 'snapshot' | 'varian' | null = value != null && unit != null ? 'snapshot' : null
  if (source == null) {
    const { data } = await supabaseAdmin
      .from(ORDERS)
      .select('variant_id')
      .eq('public_id', publicId)
      .limit(1)
    const vid = (data?.[0] as any)?.variant_id ?? null
    const liveMap = await batchVariantDurations([vid])
    const live = vid ? liveMap.get(vid) : undefined
    if (live?.value != null && live?.unit != null) {
      value = live.value
      unit = live.unit
      source = 'varian'
    }
  }
  const facts = toFacts({ ...order, durationValue: value, durationUnit: unit })
  const expiry = computeExpiry(facts.paidAt, value, unit)
  if (!order.paidAt) return { facts, reason: 'tanpa paid_at' }
  if (source == null) return { facts, reason: 'tanpa durasi (snapshot + varian)' }
  if (expiry && expiry.getTime() <= Date.now()) return { facts, reason: 'sudah kadaluarsa' }
  return { facts, reason: null }
}

export const remindersService = {
  // Called after a transition to PAID commits (admin approve, webhook
  // claimPaid, manual order). Uses resolveFacts so auto-scheduling benefits
  // from the live-variant fallback, matching manual toggles. Skips audit
  // the reason (no paid_at / no duration / expired) so ops sees why an
  // order silently got no event. State only flips on success.
  async handlePaid(publicId: string) {
    const { facts, reason } = await resolveFacts(publicId)
    if (reason) {
      await appendAudit({
        action: 'reminder:schedule',
        resourceType: 'order',
        resourcePublicId: publicId,
        snapshotText: `Penjadwalan otomatis dilewati untuk ${publicId}: ${reason}`,
        actorType: 'system',
      }).catch(() => {})
      return []
    }
    const results = await dispatchReminder('order.paid', facts)
    if (results.some((r) => r.ok)) await writeState(publicId, 'scheduled')
    await auditDispatchResults('order.paid', publicId, results)
    return results
  },

  // Called after REFUNDED/REJECTED commits. Missing remote items = ok.
  // State returns to none only when cancel lands; a provider outage keeps
  // the old state so the toggle still shows the (possibly live) event.
  async handleCancelled(publicId: string) {
    const order = await ordersService.getById(publicId)
    const results = await dispatchReminder('order.cancelled', toFacts(order))
    if (results.length === 0 || results.every((r) => r.ok)) {
      await writeState(publicId, 'none')
    }
    await auditDispatchResults('order.cancelled', publicId, results)
    return results
  },

  // Paged preview via reminder_preview RPC (exact expiry ordering in SQL).
  async preview(params: PreviewParams): Promise<{ rows: PreviewRow[]; total: number }> {
    const { data, error } = await supabaseAdmin.rpc('reminder_preview', {
      p_state: params.state,
      p_q: params.q,
      p_sort: params.sort ?? 'paidAt',
      p_dir: params.sortDir,
      p_limit: params.limit,
      p_offset: params.offset,
    })
    if (error) throw new Error(error.message)
    const list = (data ?? []) as any[]
    const liveMap = await batchVariantDurations(
      list
        .filter((r) => r.duration_snapshot == null || r.duration_snapshot_unit == null)
        .map((r) => r.variant_id),
    )
    const rows: PreviewRow[] = list.map((r) => {
      let value = r.duration_snapshot ?? null
      let unit = r.duration_snapshot_unit ?? null
      let source: 'snapshot' | 'varian' | null = value != null && unit != null ? 'snapshot' : null
      if (source == null && r.variant_id) {
        const live = liveMap.get(r.variant_id)
        if (live?.value != null && live?.unit != null) {
          value = live.value
          unit = live.unit
          source = 'varian'
        }
      }
      const expiry = computeExpiry(r.paid_at, value, unit)
      const eligible = expiry != null && expiry.getTime() > Date.now()
      return {
        publicId: r.public_id,
        productName: r.product_name,
        status: r.status,
        paidAt: r.paid_at,
        expiry: expiry ? expiry.toISOString() : null,
        durationSource: source,
        reminderState: (r.reminder_state ?? 'none') as ReminderState,
        eligible,
        reason: !r.paid_at
          ? 'tanpa paid_at'
          : source == null
            ? 'tanpa durasi (snapshot + varian)'
            : expiry && expiry.getTime() <= Date.now()
              ? 'sudah kadaluarsa'
              : source === 'varian'
                ? 'siap dijadwalkan (durasi dari varian saat ini)'
                : 'siap dijadwalkan',
      }
    })
    return { rows, total: list[0]?.total_count ? Number(list[0].total_count) : 0 }
  },

  // Per-row toggle ON. Throws 400 when no expiry is computable, 502 when
  // every provider fails (client rolls the toggle back).
  async scheduleOne(publicId: string): Promise<{ state: ReminderState }> {
    const { facts, reason } = await resolveFacts(publicId)
    if (reason) throw new BadRequestError(reason)
    const results = await dispatchReminder('order.paid', facts)
    if (!results.some((r) => r.ok)) {
      const detail = results.map((r) => `${r.provider}: ${r.error ?? 'unknown'}`).join('; ') || 'no provider enabled'
      await auditDispatchResults('order.paid', publicId, results)
      throw new Error(`Penjadwalan gagal: ${detail}`)
    }
    await writeState(publicId, 'scheduled')
    await auditDispatchResults('order.paid', publicId, results)
    return { state: 'scheduled' }
  },

  // Per-row toggle OFF: deletes the provider events, mirrors to none.
  async cancelOne(publicId: string): Promise<{ state: ReminderState }> {
    const order = await ordersService.getById(publicId)
    const results = await dispatchReminder('order.cancelled', toFacts(order))
    if (results.length > 0 && !results.every((r) => r.ok)) {
      const detail = results.map((r) => `${r.provider}: ${r.error ?? 'unknown'}`).join('; ')
      await auditDispatchResults('order.cancelled', publicId, results)
      throw new Error(`Pembatalan gagal: ${detail}`)
    }
    await writeState(publicId, 'none')
    await auditDispatchResults('order.cancelled', publicId, results)
    return { state: 'none' }
  },

  // Bulk toggle (capped by schema). Sequential: keeps subrequest math
  // predictable (ids x ~2 < 50 cap). Per-id results, never throws wholesale.
  async bulk(ids: string[], action: 'schedule' | 'cancel'): Promise<BackfillResult> {
    const results: BackfillResult['results'] = []
    let done = 0
    for (const id of ids) {
      try {
        if (action === 'schedule') await this.scheduleOne(id)
        else await this.cancelOne(id)
        done += 1
      } catch (err) {
        results.push({
          provider: 'bulk',
          event: action === 'schedule' ? 'order.paid' : 'order.cancelled',
          ok: false,
          error: `${id}: ${err instanceof Error ? err.message : 'gagal'}`,
        })
      }
    }
    await appendAudit({
      action: 'reminder:backfill',
      resourceType: 'order',
      resourceName: `${done}/${ids.length} ${action}`,
      snapshotText: `Pengingat massal ${action}: ${done} dari ${ids.length} order`,
      actorType: 'admin',
      diff: { action, done, total: ids.length },
    }).catch(() => {})
    return { scanned: ids.length, scheduled: done, skipped: ids.length - done, results }
  },
}
