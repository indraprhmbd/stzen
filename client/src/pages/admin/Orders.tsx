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
import { Refresh, Plus, Search, Key, EditPencil, Trash, Notes } from 'iconoir-react'
import { SkeletonRows } from '../../components/admin/TableSkeleton'
import { useTableSort } from '../../hooks/useTableSort'

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
  fulfillmentType: string
  vaultAvailable: number | null
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
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
  const [pendingReject, setPendingReject] = useState<AdminOrder | null>(null)
  const [pendingRefund, setPendingRefund] = useState<AdminOrder | null>(null)
  const [pendingDeliver, setPendingDeliver] = useState<AdminOrder | null>(null)
  const [receipt, setReceipt] = useState<AdminOrder | null>(null)
  const [manualVariants, setManualVariants] = useState<{ id: string; name: string; price: string | number }[]>([])
  const [mEmail, setMEmail] = useState('')
  const [mVariantId, setMVariantId] = useState('')
  const [mPaymentRef, setMPaymentRef] = useState('')
  const [mError, setMError] = useState<string | null>(null)
  const [mSaving, setMSaving] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)
  const [csvLimit, setCsvLimit] = useState(1000)

  // CSV cap follows ops.csv_limit (one-time fetch, silent fallback).
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

  const { data, loading, error, fetchedAt, refetch: fetchOrders } = useAdminQuery(async () => {
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) }
    if (activeTab.statuses) query.status = activeTab.statuses
    if (tab === 'butuh-tindakan') query.oldest = '1'
    if (q) query.q = q
    if (sortKey) { query.sort = sortKey; query.sortDir = sortDir ?? 'desc' }
    const res = await authedApiRequest((c) => c.api.v1.admin.orders.$get({ query }))
    return (await res.json()) as any as { orders: AdminOrder[]; total: number; counts: Record<string, number> }
  }, [tab, q, offset, limit, sortKey, sortDir])
  const orders = data?.orders ?? []
  const total = data?.total ?? 0
  const counts = data?.counts ?? { ALL: 0 }

  useEffect(() => { setOffset(0) }, [tab, q, limit, sortKey, sortDir])

  function switchTab(key: TabKey) {
    setQ('')
    setOffset(0)
    setActionErr(null)
    setSearchParams(key === 'butuh-tindakan' ? {} : { status: key })
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

  async function openManual() {
    setMError(null)
    if (manualVariants.length === 0) {
      try {
        const res = await authedApiRequest((c) => c.api.v1.admin.variants.$get())
        const list = (await res.json()) as { id: string; name: string; price: string | number; isActive: boolean }[]
        setManualVariants(list.filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name, price: v.price })))
      } catch { setMError('Gagal memuat varian') }
    }
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
    setMError(null)
    setMSaving(true)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.orders.manual.$post({
          json: { customerEmail: mEmail.trim(), variantId: mVariantId, paymentRef: mPaymentRef.trim() || null },
        })
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal membuat pesanan')
      }
      ;(document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()
      setMEmail('')
      setMVariantId('')
      setMPaymentRef('')
      await fetchOrders()
    } catch (err: unknown) {
      setMError(err instanceof Error ? err.message : 'Gagal membuat pesanan')
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
            if (v && tab !== 'semua') setSearchParams({ status: 'semua' })
          }} className="grow bg-transparent text-sm outline-none" />
        </label>
      </div>
      {actionErr && <div className="bg-[#fdecec] rounded-[10px] px-4 py-2.5 text-xs font-semibold text-[#b91c1c]">{actionErr}</div>}

      <div className="ad-card">
        <DataTable
          columns={[
            { label: 'ID' },
            { label: 'TANGGAL', sortKey: 'createdAt' },
            { label: 'UMUR' },
            { label: 'PRODUK' },
            { label: 'ALUR' },
            { label: 'PELANGGAN' },
            { label: 'JUMLAH', sortKey: 'amount' },
            { label: 'STATUS', sortKey: 'status' },
            { label: 'AKSI', className: 'text-right' },
          ]}
          empty={!loading && orders.length === 0}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          emptyText={tab === 'butuh-tindakan' ? 'Antrian kosong: tidak ada pesanan menunggu tindakan.' : 'Belum ada pesanan di tab ini.'}
        >
          {loading ? <SkeletonRows rows={8} cols={9} /> : orders.map((o) => {
            const stockout = o.fulfillmentType !== 'on_demand' && o.vaultAvailable === 0
            const overdue = (o.status === 'PENDING' || o.status === 'PAID') && Date.now() - new Date(o.createdAt).getTime() > 24 * 3600 * 1000
            return (
            <tr key={o.id}>
              <td><CopyCell value={o.id} display={o.id.slice(0, 8).toUpperCase()} className="ad-num text-xs font-semibold" /></td>
              <td className="text-xs ad-num text-[#6e6e73] whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
              <td className={`text-xs ad-num whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-[#6e6e73]'}`}>{formatAge(o.createdAt)}</td>
              <td className="text-[13px] ad-num font-medium">{o.productName}</td>
              <td className="whitespace-nowrap text-xs ad-num">
                {[o.fulfillmentType === 'on_demand' ? 'On-demand' : 'Vault', stockout ? 'Stok habis' : null].filter(Boolean).join(', ')}
              </td>
              <td className="ad-num text-xs text-[#6e6e73]" title={o.customerEmail ?? o.userId}>{o.customerEmail ?? o.userId.slice(0, 8)}</td>
              <td className="text-[13px] ad-num font-semibold">Rp {Number(o.amount).toLocaleString('id-ID')}</td>
              <td><StatusChip status={o.status}>{o.status}</StatusChip></td>
              <td className="text-right">
                <div className="flex justify-end gap-1.5">
                  {o.variantPublicId && (
                    <button onClick={() => navigate(`/admin/products?tab=stok&variant=${o.variantPublicId}&order=${o.id}`)} title="Lihat stok varian" aria-label="Lihat stok varian" className="ad-btn !px-2.5"><Key width={15} height={15} strokeWidth={1.5} /></button>
                  )}
                  {o.status === 'PENDING' && (
                    <>
                      <button disabled={actionLoading === o.id} onClick={() => handleAction(o.id, 'approve')} className="ad-btn ad-btn-dark"><EditPencil width={14} height={14} strokeWidth={1.5} />Setujui</button>
                          <button disabled={actionLoading === o.id} onClick={() => askReject(o)} className="ad-btn ad-btn-danger"><Trash width={14} height={14} strokeWidth={1.5} />Tolak</button>
                    </>
                  )}
                  {o.status === 'PAID' && (
                    <>
                      <button disabled={actionLoading === o.id} onClick={() => askDeliver(o)} className="ad-btn ad-btn-dark"><EditPencil width={14} height={14} strokeWidth={1.5} />Kirim</button>
                      <button disabled={actionLoading === o.id} onClick={() => askRefund(o)} className="ad-btn ad-btn-danger"><Trash width={14} height={14} strokeWidth={1.5} />Refund</button>
                    </>
                  )}
                  {actionLoading === o.id && <span className="loading loading-spinner loading-xs"></span>}
                  {o.status !== 'PENDING' && (
                    <button onClick={() => openReceipt(o)} className="ad-btn"><Notes width={14} height={14} strokeWidth={1.5} />Struk</button>
                  )}
                  {!['PENDING','PAID'].includes(o.status) && <span className="text-xs text-[#aeaeb2]">-</span>}
                </div>
              </td>
            </tr>
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
              <div className="flex justify-between"><span className="text-[#6e6e73]">Jumlah</span><span className="font-semibold">Rp {Number(receipt.amount).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between"><span className="text-[#6e6e73]">Status</span><span>{receipt.status}</span></div>
              <div className="flex justify-between"><span className="text-[#6e6e73]">Ref</span><span>{receipt.paymentRef ?? '-'}</span></div>
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
          <h3 className="font-semibold text-[17px] tracking-tight">Buat Pesanan Manual</h3>
          <form onSubmit={submitManual} className="flex flex-col gap-4 mt-5">
            <label className="ad-label">Email Pelanggan<input type="email" required value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="pelanggan@email.com" className="ad-input mt-1.5 normal-case" /></label>
            <label className="ad-label">Varian<select value={mVariantId} onChange={(e) => setMVariantId(e.target.value)} required className="ad-input mt-1.5"><option value="">Pilih varian</option>{manualVariants.map((v) => <option key={v.id} value={v.id}>{v.name} - Rp {Number(v.price).toLocaleString('id-ID')}</option>)}</select></label>
            <label className="ad-label">Ref Bayar (opsional)<input type="text" value={mPaymentRef} onChange={(e) => setMPaymentRef(e.target.value)} placeholder="tunai / transfer ..." className="ad-input mt-1.5 normal-case" /></label>
            {mError && <p className="text-xs font-semibold text-red-600">{mError}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => (document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Batal</button>
              <button type="submit" disabled={mSaving} className="ad-btn ad-btn-dark">{mSaving ? 'Menyimpan...' : 'Buat Pesanan'}</button>
            </div>
          </form>
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
      <ConfirmDialog
        id="refund-confirm"
        title="Refund pesanan?"
        message={pendingRefund ? `Pesanan ${pendingRefund.productName} dikembalikan ke REFUNDED, stok vault dilepas.` : ''}
        confirmLabel="Ya, refund"
        onConfirm={confirmRefund}
      />
    </div>
  )
}
