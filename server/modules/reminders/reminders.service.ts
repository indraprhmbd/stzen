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
        'public_id, status, paid_at, amount, duration_snapshot, duration_snapshot_unit, variant_name_snapshot, base_name_snapshot',
      )
      .in('status', ['PAID', 'DELIVERED'])
      .order('paid_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return (rows ?? []).map((r: any) => {
      const expiry = computeExpiry(r.paid_at, r.duration_snapshot, r.duration_snapshot_unit)
      const eligible = expiry != null && expiry.getTime() > Date.now()
      return {
        publicId: r.public_id,
        productName: r.variant_name_snapshot ?? r.base_name_snapshot ?? 'Produk',
        status: r.status,
        paidAt: r.paid_at,
        expiry: expiry ? expiry.toISOString() : null,
        eligible,
        reason: !r.paid_at
          ? 'tanpa paid_at'
          : r.duration_snapshot == null
            ? 'tanpa durasi'
            : expiry && expiry.getTime() <= Date.now()
              ? 'sudah kadaluarsa'
              : 'siap dijadwalkan',
      }
    })
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
      const res = await dispatchReminder('order.paid', toFacts(order))
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
