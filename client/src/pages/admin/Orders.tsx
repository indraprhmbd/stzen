import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/admin/StatusChip'
import ConfirmDialog, { openConfirm } from '../../components/admin/ConfirmDialog'
import DeliverDialog, { openConfirm as openDialog } from '../../components/admin/DeliverDialog'
import { printReceipt as printOrderReceipt } from '../../lib/receipt'

interface AdminOrder {
  id: string
  productName: string
  userId: string
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
  const rawTab = searchParams.get('status')
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'butuh-tindakan'
  const activeTab = TABS.find((t) => t.key === tab)!
  const [offset, setOffset] = useState(0)
  const limit = 20
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

  const { data, loading, error, fetchedAt, refetch: fetchOrders } = useAdminQuery(async () => {
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) }
    if (activeTab.statuses) query.status = activeTab.statuses
    if (tab === 'butuh-tindakan') query.oldest = '1'
    if (q) query.q = q
    const res = await authedApiRequest((c) => c.api.v1.admin.orders.$get({ query }))
    return (await res.json()) as { orders: AdminOrder[]; total: number; counts: Record<string, number> }
  }, [tab, q, offset])
  const orders = data?.orders ?? []
  const total = data?.total ?? 0
  const counts = data?.counts ?? { ALL: 0 }

  useEffect(() => { setOffset(0) }, [tab, q])

  // Auto-refresh the action queue every 30s; archives stay manual.
  // Skips ticks while the browser tab is hidden (hot-reload safe: HMR keeps
  // the interval, visibility guard keeps it from polling in background).
  const fetchRef = useRef(fetchOrders)
  fetchRef.current = fetchOrders
  useEffect(() => {
    if (tab !== 'butuh-tindakan') return
    const t = setInterval(() => {
      if (document.hidden) return
      fetchRef.current()
    }, 30000)
    return () => clearInterval(t)
  }, [tab])

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
    setExportBusy(true)
    try {
      const query: Record<string, string> = { limit: '1000', offset: '0' }
      if (activeTab.statuses) query.status = activeTab.statuses
      if (q) query.q = q
      const res = await authedApiRequest((c) => c.api.v1.admin.orders.$get({ query }))
      const json = (await res.json()) as { orders: AdminOrder[] }
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

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  if (error) return <div className="bg-white border border-red-200 p-8 text-center"><div className="text-sm font-bold text-red-600">Gagal memuat</div><div className="text-xs text-zinc-500 mt-1">{error}</div><button onClick={fetchOrders} className="btn btn-sm bg-zinc-900 text-white rounded-sm mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-zinc-200 pb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Pesanan</h1>
          <p className="text-sm text-zinc-500 mt-1"><span className="font-mono text-zinc-900 font-semibold">{counts.ALL ?? 0}</span> total · <span className="font-mono">{counts.PENDING ?? 0}</span> pending · <span className="font-mono">{counts.PAID ?? 0}</span> dibayar{fetchedAt && <span className="font-mono text-zinc-400"> · Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportErr && <span className="text-xs font-semibold text-red-600">{exportErr}</span>}
          <button onClick={() => fetchOrders()} className="text-xs font-semibold border border-zinc-200 bg-white px-4 py-1.5 hover:bg-zinc-900 hover:text-white">Muat ulang</button>
          <button onClick={exportCsv} disabled={exportBusy} className="text-xs font-semibold border border-zinc-200 bg-white px-4 py-1.5 hover:bg-zinc-900 hover:text-white disabled:opacity-40">{exportBusy ? 'Mengekspor...' : 'Ekspor CSV'}</button>
          <button onClick={openManual} className="text-xs font-semibold bg-zinc-900 text-white px-4 py-1.5 hover:bg-black">+ Manual</button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 p-3 flex flex-col gap-3">
        <div role="tablist" aria-label="Antrian pesanan" className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => switchTab(t.key)}
              className={`text-xs font-bold px-4 py-2 border ${tab === t.key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-900'}`}
            >
              {t.label} <span className="font-mono opacity-70">({tabCount(t.key)})</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 border border-zinc-200 px-3 py-2 bg-zinc-50">
          <span className="text-[11px] font-bold tracking-widest text-zinc-400">CARI</span>
          <input placeholder="produk / ref bayar..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none placeholder:text-zinc-400" />
        </label>
      </div>
      {actionErr && <div className="bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700">{actionErr}</div>}

      <div className="bg-white border border-zinc-200 overflow-hidden">
        <DataTable
          columns={[
            { label: 'ID' },
            { label: 'TANGGAL' },
            { label: 'UMUR' },
            { label: 'PRODUK' },
            { label: 'ALUR' },
            { label: 'PELANGGAN' },
            { label: 'JUMLAH' },
            { label: 'STATUS' },
            { label: 'AKSI', className: 'text-right' },
          ]}
          empty={orders.length === 0}
          emptyText={tab === 'butuh-tindakan' ? 'Antrian kosong: tidak ada pesanan menunggu tindakan.' : 'Belum ada pesanan di tab ini.'}
        >
          {orders.map((o) => {
            const stockout = o.fulfillmentType !== 'on_demand' && o.vaultAvailable === 0
            const overdue = (o.status === 'PENDING' || o.status === 'PAID') && Date.now() - new Date(o.createdAt).getTime() > 24 * 3600 * 1000
            return (
            <tr key={o.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
              <td className="font-mono text-xs font-bold tracking-wide py-3.5">{o.id.slice(0, 8).toUpperCase()}</td>
              <td className="text-xs font-mono text-zinc-600 whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
              <td className={`text-xs font-mono whitespace-nowrap ${overdue ? 'text-red-600 font-bold' : 'text-zinc-600'}`}>{formatAge(o.createdAt)}</td>
              <td className="text-[13px] font-semibold max-w-[180px] truncate">{o.productName}</td>
              <td className="whitespace-nowrap">
                <span className={`inline-block text-[10px] font-bold tracking-widest px-2 py-0.5 border ${o.fulfillmentType === 'on_demand' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                  {o.fulfillmentType === 'on_demand' ? 'ON-DEMAND' : 'VAULT'}
                </span>
                {stockout && <span className="inline-block ml-1 text-[10px] font-bold tracking-widest px-2 py-0.5 border bg-red-600 text-white border-red-600">STOK HABIS</span>}
              </td>
              <td className="font-mono text-xs text-zinc-600">{o.userId.slice(0, 8)}</td>
              <td className="text-sm font-mono font-semibold">Rp {Number(o.amount).toLocaleString('id-ID')}</td>
              <td><StatusChip status={o.status}>{o.status}</StatusChip></td>
              <td className="text-right">
                <div className="flex justify-end gap-1.5">
                  {o.status === 'PENDING' && (
                    <>
                      <button disabled={actionLoading === o.id} onClick={() => handleAction(o.id, 'approve')} className="text-xs font-semibold border border-zinc-900 bg-zinc-900 text-white px-3 py-1 hover:bg-black disabled:opacity-40">Setujui</button>
                          <button disabled={actionLoading === o.id} onClick={() => askReject(o)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-40">Tolak</button>
                    </>
                  )}
                  {o.status === 'PAID' && (
                    <>
                      <button disabled={actionLoading === o.id} onClick={() => askDeliver(o)} className="text-xs font-semibold border border-zinc-900 bg-zinc-900 text-white px-3 py-1 hover:bg-black disabled:opacity-40">Kirim</button>
                      <button disabled={actionLoading === o.id} onClick={() => askRefund(o)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-40">Refund</button>
                    </>
                  )}
                  {actionLoading === o.id && <span className="loading loading-spinner loading-xs"></span>}
                  {o.status !== 'PENDING' && (
                    <button onClick={() => openReceipt(o)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-zinc-900 hover:text-white disabled:opacity-40">Struk</button>
                  )}
                  {!['PENDING','PAID'].includes(o.status) && <span className="text-xs text-zinc-400">-</span>}
                </div>
              </td>
            </tr>
            )
          })}
        </DataTable>
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50">
          <span className="text-xs font-mono text-zinc-500">{total} pesanan</span>
          <div className="flex gap-2">
            <button onClick={() => { setOffset((o) => Math.max(0, o - limit)); }} className="text-xs font-semibold text-zinc-900 hover:text-black disabled:opacity-40" disabled={offset === 0}>← Kembali</button>
            <button onClick={() => { setOffset((o) => o + limit); }} className="text-xs font-semibold text-zinc-900 hover:text-black disabled:opacity-40" disabled={offset + limit >= total}>Lanjut →</button>
          </div>
        </div>
      </div>
      <dialog id="receipt_modal" className="modal">
        <div className="modal-box max-w-md bg-white rounded-none border border-zinc-900 p-6">
          <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Struk</h3>
          {receipt && (
            <div className="mt-4 text-sm font-mono flex flex-col gap-1.5">
              <div className="flex justify-between"><span className="text-zinc-500">ID</span><span className="font-bold">{receipt.id.slice(0, 8).toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Tanggal</span><span>{new Date(receipt.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
              <div className="flex justify-between gap-4"><span className="text-zinc-500">Produk</span><span className="text-right font-semibold">{receipt.productName}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Jumlah</span><span className="font-bold">Rp {Number(receipt.amount).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Status</span><span>{receipt.status}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Ref</span><span>{receipt.paymentRef ?? '-'}</span></div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => (document.getElementById('receipt_modal') as HTMLDialogElement | null)?.close()} className="border border-zinc-200 px-5 py-2 text-sm font-semibold">Tutup</button>
            <button onClick={printReceipt} className="bg-zinc-900 text-white px-5 py-2 text-sm font-semibold">Cetak</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      <dialog id="manual_modal" className="modal">
        <div className="modal-box max-w-md bg-white rounded-none border border-zinc-900 p-6">
          <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Buat Pesanan Manual</h3>
          <form onSubmit={submitManual} className="flex flex-col gap-4 mt-5">
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Email Pelanggan<input type="email" required value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="pelanggan@email.com" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Varian<select value={mVariantId} onChange={(e) => setMVariantId(e.target.value)} required className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"><option value="">Pilih varian</option>{manualVariants.map((v) => <option key={v.id} value={v.id}>{v.name} - Rp {Number(v.price).toLocaleString('id-ID')}</option>)}</select></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Ref Bayar (opsional)<input type="text" value={mPaymentRef} onChange={(e) => setMPaymentRef(e.target.value)} placeholder="tunai / transfer ..." className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
            {mError && <p className="text-xs font-semibold text-red-600">{mError}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => (document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()} className="border border-zinc-200 px-5 py-2 text-sm font-semibold">Batal</button>
              <button type="submit" disabled={mSaving} className="bg-zinc-900 text-white px-6 py-2 text-sm font-semibold disabled:opacity-40">{mSaving ? 'Menyimpan...' : 'Buat Pesanan'}</button>
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
