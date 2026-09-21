import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import TablePagination from '../../components/admin/TablePagination'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import DeliverDialog from '../../components/admin/DeliverDialog'
import { Refresh, Plus, Search } from 'iconoir-react'
import { SkeletonRows } from '../../components/admin/TableSkeleton'
import { useTableSort } from '../../hooks/useTableSort'
import { useRowSelection } from '../../hooks/useRowSelection'
import { SelectAllCheckbox } from '../../components/admin/RowSelection'
import AdminBulkBar from '../../components/admin/AdminBulkBar'
import TableSortMenu from '../../components/admin/TableSortMenu'
import { orderColumns, TABS, type TabKey, type AdminOrder } from './orders/types'
import { useManualOrder } from './orders/useManualOrder'
import { useRefundCalc } from './orders/useRefundCalc'
import { useOrderRowActions } from './orders/useOrderRowActions'
import OrderRow from './orders/OrderRow'
import { ReceiptDialog, ManualOrderDialog, RefundCalcDialog, TimelineDialog } from './orders/dialogs'

export default function Orders() {
  const [q, setQ] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('status')
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'butuh-tindakan'
  const activeTab = TABS.find((t) => t.key === tab)!

  useEffect(() => {
    const urlQ = searchParams.get('q')
    if (urlQ) setQ(urlQ)
  }, [searchParams])
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
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

  const rowActions = useOrderRowActions({ onMutated: fetchOrders })
  const calc = useRefundCalc({ askRefund: rowActions.askRefund })
  const manual = useManualOrder({ onMutated: fetchOrders, setActionMsg: rowActions.setActionMsg })
  const { actionErr, actionMsg } = rowActions

  function switchTab(key: TabKey) {
    setQ('')
    setOffset(0)
    rowActions.setActionErr(null)
    rowActions.setActionMsg(null)
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
          <button onClick={manual.openManual} className="ad-btn ad-btn-dark"><Plus width={15} height={15} strokeWidth={1.5} />Manual</button>
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
          <button onClick={() => void rowActions.bulkApprove(selection.selected, selection.clear)} disabled={rowActions.bulkBusy} className="ad-btn ad-btn-dark w-full sm:w-auto">
            {rowActions.bulkBusy ? 'Memproses...' : `Setujui (${selection.count})`}
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
          {loading ? <SkeletonRows rows={8} cols={10} /> : orders.map((o) => (
            <OrderRow
              key={o.id}
              o={o}
              pageIds={pageIds}
              selection={selection}
              actions={{
                actionLoading: rowActions.actionLoading,
                openReview: manual.openReview,
                approveDirect: (id) => void rowActions.handleAction(id, 'approve'),
                askDeliver: rowActions.askDeliver,
                askReject: rowActions.askReject,
                openCalculator: calc.openCalculator,
                askRefund: rowActions.askRefund,
                openReceipt: rowActions.openReceipt,
                openTimeline: rowActions.openTimeline,
              }}
            />
          ))}
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

      <ReceiptDialog receipt={rowActions.receipt} onPrint={rowActions.printReceipt} />
      <ManualOrderDialog m={manual} />
      <ConfirmDialog
        id="reject-confirm"
        title="Tolak pesanan?"
        message={rowActions.pendingReject ? `Pesanan ${rowActions.pendingReject.productName} akan ditolak.` : ''}
        confirmLabel="Ya, tolak"
        onConfirm={() => void rowActions.confirmReject()}
      />
      <DeliverDialog
        id="deliver-dialog"
        productName={rowActions.pendingDeliver?.productName ?? ''}
        onConfirm={(credential) => {
          if (!rowActions.pendingDeliver) return
          const id = rowActions.pendingDeliver.id
          rowActions.clearDeliver()
          void rowActions.handleDeliver(id, credential)
        }}
      />
      <RefundCalcDialog c={calc} />
      <ConfirmDialog
        id="refund-confirm"
        title="Refund pesanan?"
        message={rowActions.pendingRefund ? `Pesanan ${rowActions.pendingRefund.productName} dikembalikan ke REFUNDED, stok vault dilepas.` : ''}
        confirmLabel="Ya, refund"
        onConfirm={() => void rowActions.confirmRefund()}
      />
      <TimelineDialog
        timelineOrder={rowActions.timelineOrder}
        timelineRows={rowActions.timelineRows}
        timelineLoading={rowActions.timelineLoading}
        timelineErr={rowActions.timelineErr}
      />
    </div>
  )
}
