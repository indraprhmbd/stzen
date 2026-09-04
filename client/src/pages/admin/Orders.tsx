import { useState, useEffect } from 'react'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/admin/StatusChip'
import ConfirmDialog, { openConfirm } from '../../components/admin/ConfirmDialog'
import { printReceipt as printOrderReceipt } from '../../lib/receipt'

interface AdminOrder {
  id: string
  productName: string
  userId: string
  amount: string
  paymentRef: string | null
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
  createdAt: string
  paidAt: string | null
}

type FilterStatus = 'ALL' | AdminOrder['status']

export default function Orders() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<FilterStatus>('ALL')
  const [offset, setOffset] = useState(0)
  const limit = 20
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [pendingReject, setPendingReject] = useState<AdminOrder | null>(null)
  const [pendingRefund, setPendingRefund] = useState<AdminOrder | null>(null)
  const [receipt, setReceipt] = useState<AdminOrder | null>(null)
  const [manualVariants, setManualVariants] = useState<{ id: string; name: string; price: string | number }[]>([])
  const [mEmail, setMEmail] = useState('')
  const [mVariantId, setMVariantId] = useState('')
  const [mPaymentRef, setMPaymentRef] = useState('')
  const [mError, setMError] = useState<string | null>(null)
  const [mSaving, setMSaving] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)

  const { data, loading, error, refetch: fetchOrders } = useAdminQuery(async () => {
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) }
    if (status !== 'ALL') query.status = status
    if (q) query.q = q
    const res = await authedApiRequest((c) => c.api.v1.admin.orders.$get({ query }))
    return (await res.json()) as { orders: AdminOrder[]; total: number; counts: Record<string, number> }
  }, [status, q, offset])
  const orders = data?.orders ?? []
  const total = data?.total ?? 0
  const counts = data?.counts ?? { ALL: 0 }

  useEffect(() => { setOffset(0) }, [status, q])

  async function handleAction(orderId: string, action: 'approve' | 'reject' | 'deliver' | 'refund') {
    setActionLoading(orderId)
    try {
      await authedApiRequest(
        (c) => c.api.v1.admin.orders[':id'][action].$post({ param: { id: orderId } }),
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      )
      await fetchOrders()
    } finally { setActionLoading(null) }
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
    return
    const o = receipt
    const w = window.open('', '_blank')
    if (!w) return
    const dt = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const no = o.id.slice(0, 8).toUpperCase()
    const amt = 'Rp ' + Number(o.amount).toLocaleString('id-ID')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${no}</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f4f5;color:#18181b;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}.wrap{max-width:520px;margin:32px auto;background:#fff;border:1px solid #e4e4e7}.band{background:#18181b;color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}.band h1{margin:0;font-size:20px;letter-spacing:.08em}.band .sub{font-size:11px;color:#C5FE37;letter-spacing:.2em;margin-top:4px}.band .no{text-align:right;font-size:12px}.band .no b{font-size:15px}.body{padding:20px 24px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:16px}.meta div span{display:block;font-size:10px;color:#71717a;letter-spacing:.08em}.meta div b{font-size:13px}table{width:100%;border-collapse:collapse;margin-top:8px}th{font-size:10px;letter-spacing:.12em;color:#71717a;text-align:left;padding:8px 0;border-bottom:2px solid #18181b}td{padding:10px 0;border-bottom:1px dashed #d4d4d8}.r{text-align:right}.total td{border-bottom:none;border-top:2px solid #18181b;font-weight:700;font-size:15px;padding-top:12px}.foot{padding:16px 24px 24px;text-align:center;font-size:11px;color:#71717a}@media print{body{background:#fff}.wrap{margin:0;max-width:none;border:none}}</style></head><body><div class="wrap"><div class="band"><div><h1>ST.ZEN</h1><div class="sub">STRUK PEMBAYARAN</div></div><div class="no">No<br><b>${no}</b></div></div><div class="body"><div class="meta"><div><span>TANGGAL</span><b>${dt(o.createdAt)}</b></div><div><span>STATUS</span><b>${o.status}</b></div><div><span>PELANGGAN</span><b>${o.userId.slice(0, 8).toUpperCase()}</b></div><div><span>REF</span><b>${o.paymentRef ?? '-'}</b></div></div><table><thead><tr><th>DESKRIPSI</th><th class="r">HARGA</th></tr></thead><tbody><tr><td>${o.productName}</td><td class="r">${amt}</td></tr><tr class="total"><td>TOTAL</td><td class="r">${amt}</td></tr></tbody></table></div><div class="foot">Simpan struk ini sebagai bukti pembayaran<br>Dicetak ${dt(new Date().toISOString())}</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
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
      if (status !== 'ALL') query.status = status
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
          <p className="text-sm text-zinc-500 mt-1"><span className="font-mono text-zinc-900 font-semibold">{counts.ALL ?? 0}</span> total · <span className="font-mono">{counts.PENDING ?? 0}</span> pending · <span className="font-mono">{counts.PAID ?? 0}</span> dibayar</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportErr && <span className="text-xs font-semibold text-red-600">{exportErr}</span>}
          <button onClick={() => fetchOrders()} className="text-xs font-semibold border border-zinc-200 bg-white px-4 py-1.5 hover:bg-zinc-900 hover:text-white">Muat ulang</button>
          <button onClick={exportCsv} disabled={exportBusy} className="text-xs font-semibold border border-zinc-200 bg-white px-4 py-1.5 hover:bg-zinc-900 hover:text-white disabled:opacity-40">{exportBusy ? 'Mengekspor...' : 'Ekspor CSV'}</button>
          <button onClick={openManual} className="text-xs font-semibold bg-zinc-900 text-white px-4 py-1.5 hover:bg-black">+ Manual</button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 p-3 flex flex-col sm:flex-row gap-3">
        <label className="flex items-center gap-2 flex-1 border border-zinc-200 px-3 py-2 bg-zinc-50">
          <span className="text-[11px] font-bold tracking-widest text-zinc-400">CARI</span>
          <input placeholder="produk / ref bayar..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none placeholder:text-zinc-400" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as FilterStatus)} className="border border-zinc-200 bg-white px-3 py-2 text-sm font-mono w-full sm:w-56">
          <option value="ALL">Semua status ({counts.ALL ?? 0})</option>
          <option value="PENDING">PENDING ({counts.PENDING ?? 0})</option>
          <option value="PAID">PAID ({counts.PAID ?? 0})</option>
          <option value="DELIVERED">DELIVERED ({counts.DELIVERED ?? 0})</option>
          <option value="REJECTED">REJECTED ({counts.REJECTED ?? 0})</option>
          <option value="REFUNDED">REFUNDED ({counts.REFUNDED ?? 0})</option>
        </select>
      </div>

      <div className="bg-white border border-zinc-200 overflow-hidden">
        <DataTable
          columns={[
            { label: 'ID' },
            { label: 'TANGGAL' },
            { label: 'PRODUK' },
            { label: 'PELANGGAN' },
            { label: 'JUMLAH' },
            { label: 'STATUS' },
            { label: 'AKSI', className: 'text-right' },
          ]}
          empty={orders.length === 0}
          emptyText="Belum ada pesanan: transaksi akan muncul setelah checkout."
        >
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
              <td className="font-mono text-xs font-bold tracking-wide py-3.5">{o.id.slice(0, 8).toUpperCase()}</td>
              <td className="text-xs font-mono text-zinc-600 whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
              <td className="text-[13px] font-semibold max-w-[180px] truncate">{o.productName}</td>
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
                      <button disabled={actionLoading === o.id} onClick={() => handleAction(o.id, 'deliver')} className="text-xs font-semibold border border-zinc-900 bg-white text-zinc-900 px-3 py-1 hover:bg-zinc-900 hover:text-white disabled:opacity-40">Kirim</button>
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
          ))}
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
