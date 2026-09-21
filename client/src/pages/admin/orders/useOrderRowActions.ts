import { useState } from 'react'
import { authedApiRequest } from '../../../lib/api'
import { printReceipt as printOrderReceipt } from '../../../lib/receipt'
import { openConfirm } from '../../../components/admin/ConfirmDialog'
import { openConfirm as openDialog } from '../../../components/admin/DeliverDialog'
import type { AdminOrder } from './types'

export type RowAction = 'approve' | 'reject' | 'refund'

export interface RowActionsApi {
  actionLoading: string | null
  actionErr: string | null
  setActionErr: (v: string | null) => void
  actionMsg: string | null
  setActionMsg: (v: string | null) => void
  bulkBusy: boolean
  pendingReject: AdminOrder | null
  pendingRefund: AdminOrder | null
  pendingDeliver: AdminOrder | null
  receipt: AdminOrder | null
  timelineOrder: AdminOrder | null
  timelineRows: { action: string; actor_email: string | null; created_at: string; snapshot_text: string }[]
  timelineLoading: boolean
  timelineErr: string | null
  handleAction: (orderId: string, action: RowAction) => Promise<void>
  handleDeliver: (orderId: string, credential?: string) => Promise<void>
  bulkApprove: (ids: string[], onDone: () => void) => Promise<void>
  askDeliver: (o: AdminOrder) => void
  askReject: (o: AdminOrder) => void
  confirmReject: () => Promise<void>
  askRefund: (o: AdminOrder) => void
  confirmRefund: () => Promise<void>
  openReceipt: (o: AdminOrder) => void
  printReceipt: () => void
  openTimeline: (o: AdminOrder) => Promise<void>
  clearDeliver: () => void
}

export const timelineActionLabel: Record<string, string> = {
  'order:create': 'Dibuat',
  'order:approve': 'Disetujui',
  'order:reject': 'Ditolak',
  'order:deliver': 'Dikirim',
  'order:refund': 'Refund',
  'order:replace': 'Ganti akses',
  'order:update': 'Diubah',
  'warranty:claim': 'Klaim garansi',
}

export function useOrderRowActions(opts: {
  onMutated: () => void | Promise<void>
}): RowActionsApi {
  const { onMutated } = opts
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [pendingReject, setPendingReject] = useState<AdminOrder | null>(null)
  const [pendingRefund, setPendingRefund] = useState<AdminOrder | null>(null)
  const [pendingDeliver, setPendingDeliver] = useState<AdminOrder | null>(null)
  const [receipt, setReceipt] = useState<AdminOrder | null>(null)
  const [timelineOrder, setTimelineOrder] = useState<AdminOrder | null>(null)
  const [timelineRows, setTimelineRows] = useState<{ action: string; actor_email: string | null; created_at: string; snapshot_text: string }[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineErr, setTimelineErr] = useState<string | null>(null)

  async function handleAction(orderId: string, action: RowAction) {
    setActionLoading(orderId)
    setActionErr(null)
    try {
      const res = await authedApiRequest(
        (c) => c.api.v1.admin.orders[':id'][action].$post({ param: { id: orderId } }),
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal memproses')
      }
      await onMutated()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Gagal memproses')
    } finally { setActionLoading(null) }
  }

  // Flow-aware deliver. Vault orders call directly; on-demand orders go
  // through the credential dialog. STOK_HABIS leaves the order PAID.
  async function handleDeliver(orderId: string, credential?: string) {
    setActionLoading(orderId)
    setActionErr(null)
    try {
      const res = await authedApiRequest(
        (c) => c.api.v1.admin.orders[':id'].deliver.$post({ param: { id: orderId }, json: { credential } }),
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal mengirim')
      }
      await onMutated()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Gagal mengirim')
    } finally { setActionLoading(null) }
  }

  // Bulk approve: forward-only PENDING->PAID per row, inapplicable rows skip
  // with reasons. Manual-provider rows always skip (per-row review form).
  // Reject/refund stay per-row behind their confirm dialogs.
  async function bulkApprove(ids: string[], onDone: () => void) {
    if (bulkBusy || ids.length === 0) return
    setBulkBusy(true)
    setActionErr(null)
    setActionMsg(null)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.orders.bulk.$post({ json: { action: 'approve' as const, ids: ids.slice(0, 20) } })
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal menyetujui massal')
      }
      const out = (await res.json()) as { scanned: number; approved: number; skipped: { id: string; reason: string }[] }
      onDone()
      await onMutated()
      setActionMsg(out.skipped.length === 0
        ? `Disetujui: ${out.approved} pesanan`
        : `Disetujui ${out.approved} dari ${out.scanned} - ${out.skipped.length} dilewati (${out.skipped[0]!.reason})`)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Gagal menyetujui massal')
    } finally {
      setBulkBusy(false)
    }
  }

  function askDeliver(o: AdminOrder) {
    if (o.fulfillmentType === 'on_demand') {
      setPendingDeliver(o)
      openDialog('deliver-dialog')
    } else {
      void handleDeliver(o.id)
    }
  }

  function askReject(o: AdminOrder) {
    setPendingReject(o)
    openConfirm('reject-confirm')
  }

  async function confirmReject() {
    if (!pendingReject) return
    const id = pendingReject.id
    setPendingReject(null)
    await handleAction(id, 'reject')
  }

  function askRefund(o: AdminOrder) {
    setPendingRefund(o)
    openConfirm('refund-confirm')
  }

  async function confirmRefund() {
    if (!pendingRefund) return
    const id = pendingRefund.id
    setPendingRefund(null)
    await handleAction(id, 'refund')
  }

  function openReceipt(o: AdminOrder) {
    setReceipt(o)
    ;(document.getElementById('receipt_modal') as HTMLDialogElement | null)?.showModal()
  }

  function printReceipt() {
    if (!receipt) return
    printOrderReceipt(receipt)
  }
  async function openTimeline(o: AdminOrder) {
    setTimelineOrder(o)
    setTimelineRows([])
    setTimelineErr(null)
    setTimelineLoading(true)
    ;(document.getElementById('order_timeline_modal') as HTMLDialogElement | null)?.showModal()
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.history.$get({ query: { resource: o.id, limit: 50 } }))
      if (!res.ok) throw new Error('Gagal memuat riwayat')
      const json = (await res.json()) as { data: { action: string; actor_email: string | null; created_at: string; snapshot_text: string }[] }
      setTimelineRows(json.data ?? [])
    } catch (e: unknown) {
      setTimelineErr(e instanceof Error ? e.message : 'Gagal memuat riwayat')
    } finally { setTimelineLoading(false) }
  }

  function clearDeliver() {
    setPendingDeliver(null)
  }

  return {
    actionLoading, actionErr, setActionErr, actionMsg, setActionMsg,
    bulkBusy, pendingReject, pendingRefund, pendingDeliver, receipt,
    timelineOrder, timelineRows, timelineLoading, timelineErr,
    handleAction, handleDeliver, bulkApprove,
    askDeliver, askReject, confirmReject, askRefund, confirmRefund,
    openReceipt, printReceipt, openTimeline, clearDeliver,
  }
}
