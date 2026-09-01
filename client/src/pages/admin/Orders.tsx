import { useState, useEffect, useCallback, useMemo } from 'react'
import { authedApiRequest } from '../../lib/api'

interface AdminOrder {
  id: string
  productName: string
  userId: string
  amount: string
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
  createdAt: string
  paidAt: string | null
}

type FilterStatus = 'ALL' | AdminOrder['status']

export default function Orders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<FilterStatus>('ALL')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setError(null); setLoading(true)
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.orders.$get({ query: {} } as any))
      const data = await res.json() as AdminOrder[]
      setOrders(data)
    } catch (e: any) { setError(e?.message || 'Gagal memuat pesanan') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (status !== 'ALL' && o.status !== status) return false
      if (q) {
        const s = q.toLowerCase()
        if (!o.productName.toLowerCase().includes(s) && !o.userId.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [orders, q, status])

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length }
    for (const s of ['PENDING','PAID','DELIVERED','REJECTED'] as const) c[s] = orders.filter(o=>o.status===s).length
    return c
  }, [orders])

  async function handleAction(orderId: string, action: 'approve' | 'reject' | 'deliver') {
    setActionLoading(orderId)
    try {
      await authedApiRequest((c) => (c.api.v1.admin.orders as any)[`${orderId}/${action}`].$post({ param: { id: orderId } }))
      await fetchOrders()
    } finally { setActionLoading(null) }
  }

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  if (error) return <div className="bg-white border border-red-200 p-8 text-center"><div className="text-sm font-bold text-red-600">Gagal memuat</div><div className="text-xs text-zinc-500 mt-1">{error}</div><button onClick={fetchOrders} className="btn btn-sm bg-zinc-900 text-white rounded-sm mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-zinc-200 pb-5">
        <h1 className="text-[22px] font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Pesanan</h1>
        <p className="text-sm text-zinc-500 mt-1"><span className="font-mono text-zinc-900 font-semibold">{orders.length}</span> total · <span className="font-mono">{counts.PENDING}</span> pending · <span className="font-mono">{counts.PAID}</span> dibayar</p>
      </div>

      <div className="bg-white border border-zinc-200 p-3 flex flex-col sm:flex-row gap-3">
        <label className="flex items-center gap-2 flex-1 border border-zinc-200 px-3 py-2 bg-zinc-50">
          <span className="text-[11px] font-bold tracking-widest text-zinc-400">CARI</span>
          <input placeholder="produk / pelanggan..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none placeholder:text-zinc-400" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as FilterStatus)} className="border border-zinc-200 bg-white px-3 py-2 text-sm font-mono w-full sm:w-56">
          <option value="ALL">Semua status ({counts.ALL})</option>
          <option value="PENDING">PENDING ({counts.PENDING})</option>
          <option value="PAID">PAID ({counts.PAID})</option>
          <option value="DELIVERED">DELIVERED ({counts.DELIVERED})</option>
          <option value="REJECTED">REJECTED ({counts.REJECTED})</option>
        </select>
      </div>

      <div className="bg-white border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-50">
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">ID</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">TANGGAL</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">PRODUK</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">PELANGGAN</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">JUMLAH</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">STATUS</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm text-zinc-500">Belum ada pesanan: transaksi akan muncul setelah checkout.</td></tr>
              ) : filtered.map((o) => (
                <tr key={o.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                  <td className="font-mono text-xs font-bold tracking-wide py-3.5">{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="text-xs font-mono text-zinc-600 whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
                  <td className="text-[13px] font-semibold max-w-[180px] truncate">{o.productName}</td>
                  <td className="font-mono text-xs text-zinc-600">{o.userId.slice(0, 8)}</td>
                  <td className="text-sm font-mono font-semibold">Rp {Number(o.amount).toLocaleString('id-ID')}</td>
                  <td><span className="text-[11px] font-mono font-semibold tracking-wide px-2 py-1 border border-zinc-200 bg-white">{o.status}</span></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {o.status === 'PENDING' && (
                        <>
                          <button disabled={actionLoading === o.id} onClick={() => handleAction(o.id, 'approve')} className="text-xs font-semibold border border-zinc-900 bg-zinc-900 text-white px-3 py-1 hover:bg-black disabled:opacity-40">Setujui</button>
                          <button disabled={actionLoading === o.id} onClick={() => handleAction(o.id, 'reject')} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-40">Tolak</button>
                        </>
                      )}
                      {o.status === 'PAID' && (
                        <button disabled={actionLoading === o.id} onClick={() => handleAction(o.id, 'deliver')} className="text-xs font-semibold border border-zinc-900 bg-white text-zinc-900 px-3 py-1 hover:bg-zinc-900 hover:text-white disabled:opacity-40">Kirim</button>
                      )}
                      {actionLoading === o.id && <span className="loading loading-spinner loading-xs"></span>}
                      {!['PENDING','PAID'].includes(o.status) && <span className="text-xs text-zinc-400">-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
