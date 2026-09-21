import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import TablePagination from '../../components/admin/TablePagination'
import CopyCell from '../../components/admin/CopyCell'
import StatusChip from '../../components/admin/StatusChip'
import ConfirmDialog, { openConfirm } from '../../components/admin/ConfirmDialog'
import DeliverDialog, { openConfirm as openDialog } from '../../components/admin/DeliverDialog'
import { printReceipt as printOrderReceipt } from '../../lib/receipt'
import { Refresh, Plus, Search, Key, EditPencil, Trash, Notes, Calculator, Send, Undo, Clock } from 'iconoir-react'
import { SkeletonRows } from '../../components/admin/TableSkeleton'
import { useTableSort } from '../../hooks/useTableSort'
import { useRowSelection } from '../../hooks/useRowSelection'
import { SelectableRow, SelectAllCheckbox } from '../../components/admin/RowSelection'
import AdminBulkBar from '../../components/admin/AdminBulkBar'
import TableSortMenu from '../../components/admin/TableSortMenu'
import RupiahInput from '../../components/admin/RupiahInput'
import { formatIdNumber } from '../../lib/format'

// Shared by DataTable headers (desktop) and TableSortMenu (mobile <sm).
const orderColumns = [
  { label: 'ID' },
  { label: 'TANGGAL', sortKey: 'createdAt' },
  { label: 'UMUR' },
  { label: 'PRODUK' },
  { label: 'ALUR' },
  { label: 'PELANGGAN' },
  { label: 'JUMLAH', sortKey: 'amount' },
  { label: 'STATUS', sortKey: 'status' },
  { label: 'AKSI', className: 'text-right' },
]

interface AdminOrder {
  id: string
  productName: string
  userId: string
  customerEmail: string | null
  variantId: string | null
  variantPublicId: string | null
  amount: string
  paymentRef: string | null
  paymentProvider: string | null
  customerAccount: string
  waNumber: string
  fulfillmentType: string
  vaultAvailable: number | null
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
  refundAmount: number | null
  createdAt: string
  paidAt: string | null
}

// Ticket-queue tabs. `butuh-tindakan` is the combined action queue
// (PENDING,PAID oldest-first); the rest are terminal-state archives.
const TABS = [
  { key: 'butuh-tindakan', label: 'Butuh Tindakan', statuses: 'PENDING,PAID' },
  { key: 'terkirim', label: 'Terkirim', statuses: 'DELIVERED' },
  { key: 'ditolak', label: 'Ditolak', statuses: 'REJECTED' },
  { key: 'refund', label: 'Refund', statuses: 'REFUNDED' },
  { key: 'semua', label: 'Semua', statuses: '' },
] as const

type TabKey = (typeof TABS)[number]['key']

function formatAge(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}j ${mins % 60}m`
  return `${Math.floor(hours / 24)}h ${hours % 24}j`
}

interface ManualVariant { id: string; name: string; price: string | number; requiresDeliveryInfo: boolean }

interface RefundCalcData {
  amount: number
  status: string
  paidAt: string | null
  claimCount: number
  claims: { id: string; note: string | null; actorEmail: string | null; claimedAt: string }[]
  preview: { totalDays: number; usedDays: number; remainingDays: number; tier: string; fee: number; refund: number } | null
}

const refundTierLabel: Record<string, string> = {
  under_1_week: 'Pakai < 1 minggu',
  no_claim: 'Tanpa klaim',
  claims_1_2: 'Klaim 1-2',
  claims_3: 'Klaim 3',
  claims_over_3: 'Klaim > 3',
}

export default function Orders() {
  const [q, setQ] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const rawTab = searchParams.get('status')
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'butuh-tindakan'
  const activeTab = TABS.find((t) => t.key === tab)!

  useEffect(() => {
    const urlQ = searchParams.get('q')
    if (urlQ) setQ(urlQ)
  }, [searchParams])
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [pendingReject, setPendingReject] = useState<AdminOrder | null>(null)
  const [pendingRefund, setPendingRefund] = useState<AdminOrder | null>(null)
  const [calcOrder, setCalcOrder] = useState<AdminOrder | null>(null)
  const [calcData, setCalcData] = useState<RefundCalcData | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcErr, setCalcErr] = useState<string | null>(null)
  const [claimNote, setClaimNote] = useState('')
  const [claimSaving, setClaimSaving] = useState(false)
  const [pendingDeliver, setPendingDeliver] = useState<AdminOrder | null>(null)
  const [receipt, setReceipt] = useState<AdminOrder | null>(null)
  const [timelineOrder, setTimelineOrder] = useState<AdminOrder | null>(null)
  const [timelineRows, setTimelineRows] = useState<{ action: string; actor_email: string | null; created_at: string; snapshot_text: string }[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineErr, setTimelineErr] = useState<string | null>(null)
  const [manualVariants, setManualVariants] = useState<ManualVariant[]>([])
  const [mEmail, setMEmail] = useState('')
  const [mAccount, setMAccount] = useState('')
  const [mWa, setMWa] = useState('')
  // Review mode: Setujui on a manual PENDING row prefills this form instead
  // of bare-approving. Null = create mode.
  const [mReview, setMReview] = useState<AdminOrder | null>(null)
  const [mVariantId, setMVariantId] = useState('')
  const [mSearch, setMSearch] = useState('')
  const [mPaymentRef, setMPaymentRef] = useState('')
  const [mUseCustom, setMUseCustom] = useState(false)
  const [mCustomPrice, setMCustomPrice] = useState('')
  const [mStep, setMStep] = useState<1 | 2>(1)
  const [mCreated, setMCreated] = useState<{ id: string; productName: string; amount: string; status: string; createdAt: string } | null>(null)
  const [mError, setMError] = useState<string | null>(null)
  const [mSaving, setMSaving] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)
  const [csvLimit, setCsvLimit] = useState(1000)

  // CSV cap follows ops.csv_limit. Parallel with first orders fetch below:
  // two independent calls, one round-trip of latency instead of two.
  useEffect(() => {
    authedApiRequest((c) => c.api.v1.admin.settings.$get())
      .then((r) => r.json() as Promise<{ values?: Record<string, string> }>)
      .then((j) => {
        const n = parseInt(j.values?.['ops.csv_limit'] ?? '', 10)
        if (Number.isFinite(n)) setCsvLimit(Math.min(5000, Math.max(100, n)))
      })
      .catch(() => {})
  }, [])

  // Server-side sort: URL params drive API query
  const { sortKey, sortDir, toggleSort } = useTableSort([], { urlKey: 'sort', defaultKey: 'createdAt', defaultDir: 'desc' })

  const { data, loading, error, fetchedAt, refetch: fetchOrders } = useAdminQuery(async (signal) => {
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) }
    if (activeTab.statuses) query.status = activeTab.statuses
    if (tab === 'butuh-tindakan') query.oldest = '1'
    if (q) query.q = q
    if (sortKey) { query.sort = sortKey; query.sortDir = sortDir ?? 'desc' }
    const res = await authedApiRequest((c) => c.api.v1.admin.orders.$get({ query }), { signal })
    return (await res.json()) as any as { orders: AdminOrder[]; total: number; counts: Record<string, number> }
  }, [tab, q, offset, limit, sortKey, sortDir], { keepPreviousData: true })
  const orders = data?.orders ?? []
  const total = data?.total ?? 0
  const counts = data?.counts ?? { ALL: 0 }
  const pageIds = orders.map((o) => o.id)

  useEffect(() => { setOffset(0) }, [tab, q, limit, sortKey, sortDir])

  // Uniform bulk selection: checkbox column always visible, row-body clicks
  // toggle only once armed. Clears on any view change.
  const selection = useRowSelection()
  useEffect(() => { selection.clear() }, [tab, q, offset, limit, sortKey, sortDir])

  function switchTab(key: TabKey) {
    setQ('')
    setOffset(0)
    setActionErr(null)
    setActionMsg(null)
    // Merge: keep sort/page params so an active sort persists across tabs.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (key === 'butuh-tindakan') next.delete('status')
      else next.set('status', key)
      return next
    })
  }

  function tabCount(key: TabKey): number {
    if (key === 'butuh-tindakan') return (counts.PENDING ?? 0) + (counts.PAID ?? 0)
    if (key === 'semua') return counts.ALL ?? 0
    const status = TABS.find((t) => t.key === key)!.statuses
    return counts[status] ?? 0
  }

  async function handleAction(orderId: string, action: 'approve' | 'reject' | 'refund') {
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
      await fetchOrders()
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
      await fetchOrders()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Gagal mengirim')
    } finally { setActionLoading(null) }
  }

  // Bulk approve: forward-only PENDING->PAID per row, inapplicable rows skip
  // with reasons. Manual-provider rows always skip (per-row review form).
  // Reject/refund stay per-row behind their confirm dialogs.
  async function bulkApprove() {
    const ids = selection.selected
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
      selection.clear()
      await fetchOrders()
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

  function openReceipt(o: AdminOrder) {
    setReceipt(o)
    ;(document.getElementById('receipt_modal') as HTMLDialogElement | null)?.showModal()
  }

  const timelineActionLabel: Record<string, string> = {
    'order:create': 'Dibuat',
    'order:approve': 'Disetujui',
    'order:reject': 'Ditolak',
    'order:deliver': 'Dikirim',
    'order:refund': 'Refund',
    'order:replace': 'Ganti akses',
    'order:update': 'Diubah',
    'warranty:claim': 'Klaim garansi',
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

  function printReceipt() {
    if (!receipt) return
    printOrderReceipt(receipt)
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

  // Refund kalkulator: preview math is server-side; the dialog only
  // displays. Lanjut ke Refund reuses the existing refund confirm flow.
  async function loadCalcPreview(orderId: string) {
    setCalcLoading(true)
    setCalcErr(null)
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.orders[':id']['refund-preview'].$get({ param: { id: orderId } }))
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal menghitung refund')
      }
      setCalcData((await res.json()) as RefundCalcData)
    } catch (e: unknown) {
      setCalcErr(e instanceof Error ? e.message : 'Gagal menghitung refund')
      setCalcData(null)
    } finally { setCalcLoading(false) }
  }

  function openCalculator(o: AdminOrder) {
    setCalcOrder(o)
    setCalcData(null)
    setClaimNote('')
    setCalcErr(null)
    ;(document.getElementById('refund_calc_modal') as HTMLDialogElement | null)?.showModal()
    void loadCalcPreview(o.id)
  }

  async function submitClaim() {
    if (!calcOrder || claimSaving) return
    setClaimSaving(true)
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.warranty.$post({ json: { orderId: calcOrder.id, note: claimNote.trim() || undefined } }))
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal mencatat klaim')
      }
      setClaimNote('')
      await loadCalcPreview(calcOrder.id)
    } catch (e: unknown) {
      setCalcErr(e instanceof Error ? e.message : 'Gagal mencatat klaim')
    } finally { setClaimSaving(false) }
  }

  function applyCalcRefund() {
    if (!calcOrder) return
    const o = calcOrder
    ;(document.getElementById('refund_calc_modal') as HTMLDialogElement | null)?.close()
    setCalcOrder(null)
    askRefund(o)
  }

  // Manual-order derived state: selected variant, catalog vs final price,
  // and the search-filtered picker list.
  const mSelected = manualVariants.find((v) => v.id === mVariantId) ?? null
  const mCatalogPrice = mSelected ? String(mSelected.price) : ''
  const mFinalPrice = mUseCustom && mCustomPrice ? mCustomPrice : mCatalogPrice
  const mFiltered = manualVariants.filter((v) =>
    !mSearch || v.name.toLowerCase().includes(mSearch.toLowerCase())
  )

  function resetManualForm() {
    setMEmail('')
    setMVariantId('')
    setMSearch('')
    setMPaymentRef('')
    setMUseCustom(false)
    setMCustomPrice('')
    setMAccount('')
    setMWa('')
    setMReview(null)
    setMError(null)
    setMCreated(null)
    setMStep(1)
  }

  async function ensureManualVariants(): Promise<ManualVariant[]> {
    if (manualVariants.length > 0) return manualVariants
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.variants.$get({ query: { compact: '1' } }))
      const list = (await res.json()) as { id: string; name: string; price: string | number; isActive: boolean; requiresDeliveryInfo?: boolean }[]
      const mapped = list.filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name, price: v.price, requiresDeliveryInfo: v.requiresDeliveryInfo ?? false }))
      setManualVariants(mapped)
      return mapped
    } catch {
      setMError('Gagal memuat varian')
      return []
    }
  }

  async function openManual() {
    resetManualForm()
    setMError(null)
    await ensureManualVariants()
    ;(document.getElementById('manual_modal') as HTMLDialogElement | null)?.showModal()
  }

  // Review mode: manual PENDING rows land here prefilled — price + contact
  // editable, email/variant locked — instead of a bare Setujui click.
  async function openReview(o: AdminOrder) {
    resetManualForm()
    setMError(null)
    const list = await ensureManualVariants()
    const match = list.find((v) => v.id === o.variantPublicId) ?? null
    setMEmail(o.customerEmail ?? '')
    if (match) {
      setMVariantId(match.id)
      if (o.amount !== String(match.price)) {
        setMUseCustom(true)
        setMCustomPrice(o.amount)
      }
    }
    setMPaymentRef(o.paymentRef ?? '')
    setMAccount(o.customerAccount ?? '')
    setMWa(o.waNumber ?? '')
    setMReview(o)
    ;(document.getElementById('manual_modal') as HTMLDialogElement | null)?.showModal()
  }

  async function exportCsv() {
    setExportErr(null)
    if (total > csvLimit) {
      setExportErr(`Peringatan: hanya ${csvLimit} dari ${total} pesanan diekspor. Gunakan filter untuk menyaring data.`)
    }
    setExportBusy(true)
    try {
      const query: Record<string, string> = { limit: String(csvLimit), offset: '0' }
      if (activeTab.statuses) query.status = activeTab.statuses
      if (q) query.q = q
      const res = await authedApiRequest((c) => c.api.v1.admin.orders.$get({ query }))
      const json = (await res.json()) as any as { orders: AdminOrder[] }
      const head = ['id', 'tanggal', 'produk', 'jumlah', 'status', 'ref']
      const lines = json.orders.map((o) =>
        [o.id, o.createdAt, o.productName, o.amount, o.status, o.paymentRef ?? '']
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pesanan-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportErr('Gagal ekspor CSV')
    } finally {
      setExportBusy(false)
    }
  }
  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    setMError(null)
    setMSaving(true)
    try {
      // Custom amount only crosses the wire when the operator explicitly set
      // a different price; otherwise the server uses the catalog price.
      const customAmount = mUseCustom && mCustomPrice && mCustomPrice !== mCatalogPrice ? mCustomPrice : undefined
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.orders.manual.$post({
          json: {
            customerEmail: mEmail.trim(),
            variantId: mVariantId,
            paymentRef: mPaymentRef.trim() || null,
            ...(customAmount ? { amount: customAmount } : {}),
            ...(mAccount.trim() ? { customerAccount: mAccount.trim() } : {}),
            ...(mWa.trim() ? { waNumber: mWa.trim() } : {}),
          },
        })
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal membuat pesanan')
      }
      const created = (await res.json()) as { id: string; productName: string; amount: string; status: string; createdAt: string }
      setMCreated(created)
      setMStep(2)
      await fetchOrders()
    } catch (err: unknown) {
      setMError(err instanceof Error ? err.message : 'Gagal membuat pesanan')
    } finally {
      setMSaving(false)
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!mReview) return
    setMError(null)
    setMSaving(true)
    try {
      const customAmount = mUseCustom && mCustomPrice && mCustomPrice !== mCatalogPrice ? mCustomPrice : undefined
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.orders[':id']['approve-manual'].$post(
          {
            param: { id: mReview.id },
            json: {
              ...(customAmount ? { amount: customAmount } : {}),
              customerAccount: mAccount.trim(),
              waNumber: mWa.trim(),
            },
          },
          { headers: { 'Idempotency-Key': crypto.randomUUID() } }
        )
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal menyetujui')
      }
      const out = (await res.json()) as { order: AdminOrder; allocated: boolean }
      setMReview(null)
      ;(document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()
      await fetchOrders()
      setActionMsg(out.allocated ? `Disetujui + dialokasikan: ${out.order.productName}` : 'Disetujui (PAID), lanjut Kirim Akses dari antrean')
    } catch (err: unknown) {
      setMError(err instanceof Error ? err.message : 'Gagal menyetujui')
    } finally {
      setMSaving(false)
    }
  }

  if (error) return <div className="ad-card-flat p-8 text-center"><div className="text-sm font-semibold text-red-600">Gagal memuat</div><div className="text-xs text-[#6e6e73] mt-1">{error}</div><button onClick={fetchOrders} className="ad-btn ad-btn-dark mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Pesanan</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5 ad-num"><span className="text-[#1d1d1f] font-semibold">{counts.ALL ?? 0}</span> total · {counts.PENDING ?? 0} pending · {counts.PAID ?? 0} dibayar{fetchedAt && <span className="text-[#aeaeb2]"> · Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportErr && <span className="text-xs font-semibold text-red-600">{exportErr}</span>}
          <button onClick={() => fetchOrders()} className="ad-btn"><Refresh width={15} height={15} strokeWidth={1.5} />Muat ulang</button>
          <button onClick={exportCsv} disabled={exportBusy} className="ad-btn">{exportBusy ? 'Mengekspor...' : 'Ekspor CSV'}</button>
          <button onClick={openManual} className="ad-btn ad-btn-dark"><Plus width={15} height={15} strokeWidth={1.5} />Manual</button>
        </div>
      </div>

      <div className="ad-card-flat p-3 flex flex-col gap-3">
        <div role="tablist" aria-label="Antrian pesanan" className="ad-seg self-start max-w-full overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => switchTab(t.key)}
            >
              {t.label} <span className="ad-num opacity-70">({tabCount(t.key)})</span>
            </button>
          ))}
        </div>
        <label className="ad-input flex items-center gap-2">
          <Search width={15} height={15} strokeWidth={1.5} className="shrink-0 text-[#aeaeb2]" />
          <input placeholder="id / produk / ref / email pelanggan..." value={q} onChange={(e) => {
            const v = e.target.value
            setQ(v)
            // Typing searches the whole dataset: jump to Semua tab.
            // Merge: keep sort params so an active sort persists while searching.
            if (v && tab !== 'semua') setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.set('status', 'semua')
              return next
            })
          }} className="grow bg-transparent text-sm outline-none" />
        </label>
        <div className="flex justify-end">
          <TableSortMenu columns={orderColumns} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        </div>
      </div>
      {actionErr && <div className="bg-[#fdecec] rounded-[10px] px-4 py-2.5 text-xs font-semibold text-[#b91c1c]">{actionErr}</div>}
      {actionMsg && <div className="bg-[#e9f9ee] rounded-[10px] px-4 py-2.5 text-xs font-semibold text-[#15803d]">{actionMsg}</div>}

      <AdminBulkBar
        count={selection.count}
        onClear={selection.clear}
        headerCheckboxId="orders-select-all"
        actions={
          <button onClick={bulkApprove} disabled={bulkBusy} className="ad-btn ad-btn-dark w-full sm:w-auto">
            {bulkBusy ? 'Memproses...' : `Setujui (${selection.count})`}
          </button>
        }
      />

      <div className="ad-card">
        <DataTable
          columns={orderColumns}
          empty={!loading && orders.length === 0}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyText={tab === 'butuh-tindakan' ? 'Antrian kosong: tidak ada pesanan menunggu tindakan.' : 'Belum ada pesanan di tab ini.'}
          selectHeader={
            <SelectAllCheckbox
              id="orders-select-all"
              label="Pilih semua di halaman ini"
              state={selection.headerState(pageIds)}
              onToggle={() => selection.toggleAll(pageIds)}
            />
          }
        >
          {loading ? <SkeletonRows rows={8} cols={10} /> : orders.map((o) => {
            const stockout = o.fulfillmentType !== 'on_demand' && o.vaultAvailable === 0
            const overdue = (o.status === 'PENDING' || o.status === 'PAID') && Date.now() - new Date(o.createdAt).getTime() > 24 * 3600 * 1000
            return (
            <SelectableRow
              key={o.id}
              id={o.id}
              selection={selection}
              pageIds={pageIds}
              selectLabel={`Pilih pesanan ${o.id.slice(0, 8).toUpperCase()}`}
            >
              <td><CopyCell value={o.id} display={o.id.slice(0, 8).toUpperCase()} className="ad-num text-xs font-semibold" /></td>
              <td className="text-xs ad-num text-[#6e6e73] whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
              <td className={`text-xs ad-num whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-[#6e6e73]'}`}>{formatAge(o.createdAt)}</td>
              <td className="text-[13px] ad-num font-medium">{o.productName}</td>
              <td className="whitespace-nowrap text-xs ad-num">
                {[o.fulfillmentType === 'on_demand' ? 'On-demand' : 'Vault', stockout ? 'Stok habis' : null].filter(Boolean).join(', ')}
              </td>
              <td className="ad-num text-xs text-[#6e6e73]" title={o.customerEmail ?? o.userId}>{o.customerEmail ?? o.userId.slice(0, 8)}</td>
              <td className="text-[13px] ad-num font-semibold">Rp {formatIdNumber(o.amount)}
                {o.status === 'REFUNDED' && o.refundAmount != null && <div className="text-[11px] font-normal text-[#dc2626]">Refund Rp {formatIdNumber(o.refundAmount)}</div>}
              </td>
              <td><StatusChip status={o.status}>{o.status}</StatusChip></td>
              <td className="text-right">
                <div className="flex justify-end gap-1.5">
                  {o.variantPublicId && o.status !== 'DELIVERED' && (
                    <button onClick={() => navigate(`/admin/products?tab=stok&variant=${o.variantPublicId}&order=${o.id}`)} title="Lihat stok varian" aria-label="Lihat stok varian" className="ad-btn !px-2.5"><Key width={15} height={15} strokeWidth={1.5} /></button>
                  )}
                  {o.status === 'PENDING' && (
                    <>
                      <button disabled={actionLoading === o.id} onClick={() => { if (o.paymentProvider === 'manual' || o.paymentProvider == null) void openReview(o); else void handleAction(o.id, 'approve') }} className="ad-btn ad-btn-dark"><EditPencil width={14} height={14} strokeWidth={1.5} />Setujui</button>
                          <button disabled={actionLoading === o.id} onClick={() => askReject(o)} className="ad-btn ad-btn-danger"><Trash width={14} height={14} strokeWidth={1.5} />Tolak</button>
                    </>
                  )}
                  {o.status === 'PAID' && (
                    <>
                      <button disabled={actionLoading === o.id} onClick={() => askDeliver(o)} className="ad-btn ad-btn-dark"><Send width={14} height={14} strokeWidth={1.5} />Kirim Akses</button>
                      <button onClick={() => openCalculator(o)} className="ad-btn"><Calculator width={14} height={14} strokeWidth={1.5} />Hitung Refund</button>
                      <button disabled={actionLoading === o.id} onClick={() => askRefund(o)} className="ad-btn ad-btn-danger"><Undo width={14} height={14} strokeWidth={1.5} />Refund</button>
                    </>
                  )}
                  {o.status === 'DELIVERED' && (
                    <>
                      {o.variantPublicId && (
                        <button onClick={() => navigate(`/admin/products?tab=stok&variant=${o.variantPublicId}&order=${o.id}`)} title="Buka stok varian untuk ganti kredensial" className="ad-btn ad-btn-dark"><Key width={14} height={14} strokeWidth={1.5} />Ganti Akses</button>
                      )}
                      <button onClick={() => openCalculator(o)} className="ad-btn"><Calculator width={14} height={14} strokeWidth={1.5} />Hitung Refund</button>
                    </>
                  )}
                  <button onClick={() => openTimeline(o)} className="ad-btn"><Clock width={14} height={14} strokeWidth={1.5} />Riwayat</button>
                  {actionLoading === o.id && <span className="loading loading-spinner loading-xs"></span>}
                  {o.status !== 'PENDING' && (
                    <button onClick={() => openReceipt(o)} className="ad-btn"><Notes width={14} height={14} strokeWidth={1.5} />Struk</button>
                  )}
                  {!['PENDING','PAID'].includes(o.status) && <span className="text-xs text-[#aeaeb2]">-</span>}
                </div>
              </td>
            </SelectableRow>
            )
          })}
        </DataTable>
        <TablePagination
          total={total}
          limit={limit}
          offset={offset}
          onLimitChange={setLimit}
          onOffsetChange={setOffset}
          unit="pesanan"
        />
      </div>
      <dialog id="receipt_modal" className="modal">
        <div className="modal-box ad-dialog max-w-md p-6">
          <h3 className="font-semibold text-[17px] tracking-tight">Struk</h3>
          {receipt && (
            <div className="mt-4 text-sm ad-num flex flex-col gap-1.5">
              <div className="flex justify-between"><span className="text-[#6e6e73]">ID</span><span className="font-semibold">{receipt.id.slice(0, 8).toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-[#6e6e73]">Tanggal</span><span>{new Date(receipt.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Produk</span><span className="text-right font-medium">{receipt.productName}</span></div>
              <div className="flex justify-between"><span className="text-[#6e6e73]">Jumlah</span><span className="font-semibold">Rp {formatIdNumber(receipt.amount)}</span></div>
              <div className="flex justify-between"><span className="text-[#6e6e73]">Status</span><span>{receipt.status}</span></div>
              <div className="flex justify-between"><span className="text-[#6e6e73]">Ref</span><span>{receipt.paymentRef ?? '-'}</span></div>
              {(receipt.customerAccount || receipt.waNumber) && (
                <>
                  {receipt.customerAccount && <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Akun</span><span className="text-right font-medium break-all">{receipt.customerAccount}</span></div>}
                  {receipt.waNumber && <div className="flex justify-between"><span className="text-[#6e6e73]">WA</span><span className="font-mono font-semibold">+{receipt.waNumber}</span></div>}
                </>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => (document.getElementById('receipt_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Tutup</button>
            <button onClick={printReceipt} className="ad-btn ad-btn-dark">Cetak</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      <dialog id="manual_modal" className="modal">
        <div className="modal-box ad-dialog max-w-md p-6">
          {mStep === 1 ? (
            <>
              <h3 className="font-semibold text-[17px] tracking-tight">{mReview ? 'Review Pesanan Manual' : 'Buat Pesanan Manual'}</h3>
              <p className="text-xs text-[#6e6e73] mt-1">{mReview ? 'Periksa harga + kontak, konfirmasi untuk setujui + alokasi.' : 'Pesanan tercatat PENDING - setujui dari antrean untuk alokasi stok.'}</p>
              <form onSubmit={mReview ? submitReview : submitManual} className="flex flex-col gap-4 mt-5">
                <label className="ad-label">Email Pelanggan
                  <input type="email" required disabled={mReview !== null} value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="pelanggan@email.com" className="ad-input mt-1.5 normal-case" />
                  <span className="text-[11px] text-[#aeaeb2] mt-1 normal-case font-normal">{mReview ? 'Pemilik pesanan (terkunci).' : 'Harus sudah terdaftar (punya akun).'}</span>
                </label>
                <div>
                  <span className="ad-label">Varian</span>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      disabled={mReview !== null}
                      value={mSelected ? `${mSelected.name} - Rp ${formatIdNumber(mSelected.price)}` : mReview ? mReview.productName : mSearch}
                      onChange={(e) => { setMVariantId(''); setMSearch(e.target.value) }}
                      onFocus={() => { if (mSelected) { setMSearch(''); setMVariantId('') } }}
                      placeholder="Ketik untuk cari varian..."
                      className="ad-input normal-case pr-9"
                    />
                    <Search width={15} height={15} strokeWidth={1.5} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aeaeb2] pointer-events-none" />
                  </div>
                  {!mSelected && !mReview && (
                    <div className="mt-1.5 max-h-44 overflow-y-auto rounded-[10px] border border-[#e8e8ed]">
                      {mFiltered.length === 0 ? (
                        <p className="text-xs text-[#aeaeb2] px-3 py-2.5">Tidak ada varian cocok.</p>
                      ) : (
                        mFiltered.slice(0, 30).map((v) => (
                          <button
                            type="button"
                            key={v.id}
                            onClick={() => { setMVariantId(v.id); setMSearch('') }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#f5f5f7] border-b border-[#f4f4f5] last:border-0"
                          >
                            <span className="text-[13px] font-medium truncate">{v.name}</span>
                            <span className="ad-num text-xs font-semibold shrink-0">Rp {formatIdNumber(v.price)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {mSelected && (
                  <div className="rounded-[10px] border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={mUseCustom} onChange={(e) => { setMUseCustom(e.target.checked); setMCustomPrice('') }} className="checkbox checkbox-sm" />
                      <span className="text-xs font-semibold">Harga berbeda dari katalog</span>
                    </label>
                    {mUseCustom && (
                      <div className="mt-2">
                        <RupiahInput label="Harga final (Rp)" required value={mCustomPrice} onChange={setMCustomPrice} placeholder={mCatalogPrice} />
                      </div>
                    )}
                  </div>
                )}
                <label className="ad-label">Ref Bayar (opsional)<input type="text" value={mPaymentRef} onChange={(e) => setMPaymentRef(e.target.value)} placeholder="tunai / transfer ..." className="ad-input mt-1.5 normal-case" /></label>
                <div className="-mt-2 flex max-w-full gap-1.5 overflow-x-auto pb-0.5 *:shrink-0">
                  {['SEABANK', 'QRIS', 'TF BANK', 'TUNAI'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMPaymentRef(r)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide transition-colors ${mPaymentRef === r ? 'border-black bg-black text-white' : 'border-[#e0e0e6] bg-white text-[#6e6e73] hover:border-black hover:text-black'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="ad-label">Akun Tujuan{mSelected?.requiresDeliveryInfo ? ' *' : ''}
                    <input type="text" value={mAccount} onChange={(e) => setMAccount(e.target.value)} placeholder="email / username tujuan" className="ad-input mt-1.5 normal-case" />
                  </label>
                  <label className="ad-label">No. WA{mSelected?.requiresDeliveryInfo ? ' *' : ''}
                    <input type="tel" value={mWa} onChange={(e) => setMWa(e.target.value)} placeholder="08..." className="ad-input mt-1.5 normal-case" />
                  </label>
                </div>
                {mSelected?.requiresDeliveryInfo && <p className="text-[11px] text-[#aeaeb2] -mt-2">Varian ini wajib info pengiriman.</p>}
                {mSelected && (
                  <div className="ad-num text-[13px] border-t-2 border-dashed border-[#e8e8ed] pt-3 flex flex-col gap-1.5">
                    <div className="text-[11px] font-bold tracking-wider text-[#aeaeb2]">PRATINJAU STRUK</div>
                    <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Varian</span><span className="text-right font-medium normal-case">{mSelected.name}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Pelanggan</span><span className="text-right truncate normal-case">{mEmail || '-'}</span></div>
                    {mUseCustom && mFinalPrice ? (
                      <>
                        <div className="flex justify-between"><span className="text-[#6e6e73]">Katalog</span><s className="text-[#aeaeb2]">Rp {formatIdNumber(mCatalogPrice)}</s></div>
                        <div className="flex justify-between"><span className="text-[#6e6e73]">Harga final</span><span className="font-semibold">Rp {formatIdNumber(mFinalPrice)}</span></div>
                      </>
                    ) : (
                      <div className="flex justify-between"><span className="text-[#6e6e73]">Harga</span><span className="font-semibold">Rp {formatIdNumber(mCatalogPrice)}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-[#6e6e73]">Ref</span><span className="normal-case">{mPaymentRef || '-'}</span></div>
                    {(mAccount || mWa) && (
                      <>
                        {mAccount && <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Akun</span><span className="text-right font-medium break-all normal-case">{mAccount}</span></div>}
                        {mWa && <div className="flex justify-between"><span className="text-[#6e6e73]">WA</span><span className="font-mono font-semibold">+{mWa}</span></div>}
                      </>
                    )}
                  </div>
                )}
                {mError && <p className="text-xs font-semibold text-red-600">{mError}</p>}
                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => (document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Batal</button>
                  <button type="submit" disabled={mSaving || !mSelected || (mUseCustom && !mCustomPrice)} className="ad-btn ad-btn-dark">{mSaving ? 'Menyimpan...' : mReview ? 'Setujui & Alokasikan' : 'Buat Pesanan'}</button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-[17px] tracking-tight">Pesanan Dibuat</h3>
              {mCreated && (
                <div className="mt-4 text-sm ad-num flex flex-col gap-1.5">
                  <div className="flex justify-between"><span className="text-[#6e6e73]">ID</span><span className="font-semibold">{mCreated.id.slice(0, 8).toUpperCase()}</span></div>
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Tanggal</span><span>{new Date(mCreated.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Produk</span><span className="text-right font-medium normal-case">{mCreated.productName}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Pelanggan</span><span className="text-right truncate normal-case">{mEmail}</span></div>
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Jumlah</span><span className="font-semibold">Rp {formatIdNumber(mCreated.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Status</span><StatusChip status={mCreated.status}>{mCreated.status}</StatusChip></div>
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Ref</span><span className="normal-case">{mPaymentRef || '-'}</span></div>
                </div>
              )}
              {mError && <p className="text-xs font-semibold text-red-600 mt-3">{mError}</p>}
              <div className="flex justify-end gap-2 mt-5">
                <button type="button" onClick={() => { resetManualForm() }} className="ad-btn">Buat Lagi</button>
                <button type="button" onClick={() => (document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()} className="ad-btn ad-btn-dark">Selesai</button>
              </div>
            </>
          )}
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      <ConfirmDialog
        id="reject-confirm"
        title="Tolak pesanan?"
        message={pendingReject ? `Pesanan ${pendingReject.productName} akan ditolak.` : ''}
        confirmLabel="Ya, tolak"
        onConfirm={confirmReject}
      />
      <DeliverDialog
        id="deliver-dialog"
        productName={pendingDeliver?.productName ?? ''}
        onConfirm={(credential) => {
          if (!pendingDeliver) return
          const id = pendingDeliver.id
          setPendingDeliver(null)
          void handleDeliver(id, credential)
        }}
      />
      <dialog id="refund_calc_modal" className="modal">
        <div className="modal-box ad-dialog max-w-md p-6">
          <h3 className="font-semibold text-[17px] tracking-tight">Hitung Refund</h3>
          <p className="text-xs text-[#6e6e73] mt-1">{calcOrder ? `${calcOrder.productName} · ${calcOrder.id.slice(0, 8).toUpperCase()}` : ''}</p>
          {calcLoading ? (
            <div className="py-8"><div className="h-9 w-full animate-pulse rounded-[8px] bg-[#f1f1f4]" /></div>
          ) : calcErr ? (
            <p className="text-xs font-semibold text-red-600 mt-4">{calcErr}</p>
          ) : calcData && (
            <div className="mt-4 text-sm ad-num flex flex-col gap-1.5">
              <div className="flex justify-between"><span className="text-[#6e6e73]">Harga beli</span><span className="font-semibold">Rp {formatIdNumber(calcData.amount)}</span></div>
              {calcData.preview ? (
                <>
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Total durasi</span><span>{calcData.preview.totalDays} hari</span></div>
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Terpakai</span><span>{calcData.preview.usedDays.toFixed(1)} hari</span></div>
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Sisa</span><span>{calcData.preview.remainingDays.toFixed(1)} hari</span></div>
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Klaim garansi</span><span>{calcData.claimCount}x · {refundTierLabel[calcData.preview.tier] ?? calcData.preview.tier} (×{calcData.preview.fee})</span></div>
                  <div className="flex justify-between border-t-2 border-dashed border-[#e8e8ed] pt-2 mt-1"><span className="font-semibold">Refund</span><span className="font-semibold text-[#dc2626]">Rp {formatIdNumber(calcData.preview.refund)}</span></div>
                </>
              ) : (
                <p className="text-xs text-[#aeaeb2]">Tanpa snapshot durasi — refund manual penuh, nominal dihitung di luar.</p>
              )}
              {calcData.claims.length > 0 && (
                <div className="mt-2 rounded-[10px] border border-[#e8e8ed] max-h-32 overflow-y-auto">
                  {calcData.claims.map((cl) => (
                    <div key={cl.id} className="px-3 py-2 border-b border-[#f4f4f5] last:border-0 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium truncate">{cl.note || 'Rotasi kredensial'}</span>
                        <span className="text-[#aeaeb2] shrink-0">{new Date(cl.claimedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {cl.actorEmail && <div className="text-[#aeaeb2] truncate">{cl.actorEmail}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <input type="text" value={claimNote} onChange={(e) => setClaimNote(e.target.value)} placeholder="Catatan klaim (opsional)" maxLength={500} className="ad-input normal-case flex-1" />
                <button onClick={() => void submitClaim()} disabled={claimSaving} className="ad-btn shrink-0">{claimSaving ? '...' : 'Catat klaim'}</button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => (document.getElementById('refund_calc_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Tutup</button>
            <button onClick={applyCalcRefund} disabled={!calcData?.preview || calcData.status !== 'PAID' && calcData.status !== 'DELIVERED'} className="ad-btn ad-btn-danger">Lanjut ke Refund</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>
      <ConfirmDialog
        id="refund-confirm"
        title="Refund pesanan?"
        message={pendingRefund ? `Pesanan ${pendingRefund.productName} dikembalikan ke REFUNDED, stok vault dilepas.` : ''}
        confirmLabel="Ya, refund"
        onConfirm={confirmRefund}
      />
      <dialog id="order_timeline_modal" className="modal">
        <div className="modal-box ad-dialog max-w-md p-6">
          <h3 className="font-semibold text-[17px] tracking-tight">Riwayat Pesanan</h3>
          <p className="text-xs text-[#6e6e73] mt-1">{timelineOrder ? `${timelineOrder.productName} · ${timelineOrder.id.slice(0, 8).toUpperCase()}` : ''}</p>
          {timelineLoading ? (
            <div className="py-8"><div className="h-9 w-full animate-pulse rounded-[8px] bg-[#f1f1f4]" /></div>
          ) : timelineErr ? (
            <p className="text-xs font-semibold text-red-600 mt-4">{timelineErr}</p>
          ) : timelineRows.length === 0 ? (
            <p className="text-xs text-[#aeaeb2] mt-4">Belum ada peristiwa tercatat.</p>
          ) : (
            <div className="mt-4 rounded-[10px] border border-[#e8e8ed] max-h-80 overflow-y-auto">
              {timelineRows.map((t, i) => (
                <div key={i} className="px-3 py-2 border-b border-[#f4f4f5] last:border-0 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{timelineActionLabel[t.action] ?? t.action}</span>
                    <span className="text-[#aeaeb2] shrink-0 ad-num">{new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="text-[#6e6e73] mt-0.5 break-words">{t.snapshot_text}</div>
                  {t.actor_email && <div className="text-[#aeaeb2] truncate">{t.actor_email}</div>}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => (document.getElementById('order_timeline_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Tutup</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>
    </div>
  )
}
