// ─── Reminders service ──────────────────────────────────────────────────
// Bridges order state changes to the provider-agnostic notify dispatcher.
// Cross-module reads go through ordersService (rule 2); provider access
// goes through the shared dispatcher, so this module never imports a
// provider file and orders never imports this module (no cycles).

import { supabaseAdmin } from '../../shared/db'
import { appendAudit } from '../../shared/lib/audit'
import { computeExpiry } from '../../shared/lib/notify/expiry'
import { dispatchReminder } from '../../shared/lib/notify/notify.dispatcher'
import { auditDispatchResults } from '../../shared/lib/notify/notify.audit'
import type { OrderReminderFacts } from '../../shared/lib/notify/notify.types'
import { service as ordersService } from '../orders'
import type { BackfillResult, PreviewRow } from './reminders.types'

const ORDERS = 'orders'
const PRODUCT_VARIANTS = 'product_variants'

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
async function resolveDuration(
  snapshotValue: number | null,
  snapshotUnit: string | null,
  variantId: string | null,
): Promise<{ value: number | null; unit: string | null; source: 'snapshot' | 'varian' | null }> {
  if (snapshotValue != null && snapshotUnit != null) {
    return { value: snapshotValue, unit: snapshotUnit, source: 'snapshot' }
  }
  if (variantId) {
    const { data: v } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('duration_months, duration_unit')
      .eq('id', variantId)
      .limit(1)
    const live = v?.[0] as any
    if (live?.duration_months != null && live?.duration_unit != null) {
      return { value: live.duration_months, unit: live.duration_unit, source: 'varian' }
    }
  }
  return { value: null, unit: null, source: null }
}

export const remindersService = {
  // Called after a transition to PAID commits (admin approve, webhook
  // claimPaid, manual order). No-duration orders resolve to no expiry and
  // are skipped by the dispatcher - not an error.
  async handlePaid(publicId: string) {
    const order = await ordersService.getById(publicId)
    const results = await dispatchReminder('order.paid', toFacts(order))
    await auditDispatchResults('order.paid', publicId, results)
    return results
  },

  // Called after REFUNDED/REJECTED commits. Missing remote items = ok.
  async handleCancelled(publicId: string) {
    const order = await ordersService.getById(publicId)
    const results = await dispatchReminder('order.cancelled', toFacts(order))
    await auditDispatchResults('order.cancelled', publicId, results)
    return results
  },

  // DangerZone-style preview: which live orders would get a reminder.
  async preview(limit = 50): Promise<PreviewRow[]> {
    const { data: rows, error } = await supabaseAdmin
      .from(ORDERS)
      .select(
        'public_id, status, paid_at, amount, variant_id, duration_snapshot, duration_snapshot_unit, variant_name_snapshot, base_name_snapshot',
      )
      .in('status', ['PAID', 'DELIVERED'])
      .order('paid_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    const out: PreviewRow[] = []
    for (const r of (rows ?? []) as any[]) {
      const dur = await resolveDuration(r.duration_snapshot, r.duration_snapshot_unit, r.variant_id)
      const expiry = computeExpiry(r.paid_at, dur.value, dur.unit)
      const eligible = expiry != null && expiry.getTime() > Date.now()
      out.push({
        publicId: r.public_id,
        productName: r.variant_name_snapshot ?? r.base_name_snapshot ?? 'Produk',
        status: r.status,
        paidAt: r.paid_at,
        expiry: expiry ? expiry.toISOString() : null,
        durationSource: dur.source,
        eligible,
        reason: !r.paid_at
          ? 'tanpa paid_at'
          : dur.source == null
            ? 'tanpa durasi (snapshot + varian)'
            : expiry && expiry.getTime() <= Date.now()
              ? 'sudah kadaluarsa'
              : dur.source === 'varian'
                ? 'siap dijadwalkan (durasi dari varian saat ini)'
                : 'siap dijadwalkan',
      })
    }
    return out
  },

  // Manual catch-up for orders paid before the feature shipped (or while a
  // provider was down). Capped per call; admin repeats until drained.
  async backfill(limit = 10): Promise<BackfillResult> {
    const rows = await this.preview(200)
    const due = rows.filter((r) => r.eligible).slice(0, limit)
    let scheduled = 0
    const results: BackfillResult['results'] = []
    for (const row of due) {
      const order = await ordersService.getById(row.publicId)
      // Preview may have resolved duration from the live variant while the
      // snapshot is null: carry the same fallback so schedule sees it.
      let value = order.durationValue
      let unit = order.durationUnit
      if ((value == null || unit == null) && row.durationSource === 'varian') {
        const { data } = await supabaseAdmin
          .from(ORDERS)
          .select('variant_id')
          .eq('public_id', row.publicId)
          .limit(1)
        const vid = (data?.[0] as any)?.variant_id ?? null
        const dur = await resolveDuration(null, null, vid)
        value = dur.value
        unit = dur.unit
      }
      const res = await dispatchReminder(
        'order.paid',
        toFacts({ ...order, durationValue: value, durationUnit: unit }),
      )
      results.push(...res)
      if (res.some((x) => x.ok)) scheduled += 1
    }
    await appendAudit({
      action: 'reminder:backfill',
      resourceType: 'order',
      resourceName: `${scheduled}/${due.length}`,
      snapshotText: `Backfill pengingat: ${scheduled} dari ${due.length} order dijadwalkan`,
      actorType: 'admin',
      diff: { scanned: rows.length, scheduled, skipped: rows.length - due.length },
    }).catch(() => {})
    return { scanned: rows.length, scheduled, skipped: rows.length - due.length, results }
  },
}
