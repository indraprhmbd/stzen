import { useState, useEffect, useCallback } from 'react'
import { authedApiRequest } from '../../lib/api'
import { supabase } from '../../lib/supabase'

interface Stats {
  totalProducts: number
  totalStock: number
  pendingOrders: number
  revenue: string
}

interface Order {
  id: string
  productName: string
  amount: string
  status: string
  createdAt: string
}

interface Product {
  id: string
  name: string
  stockCount: number
}

const statDefs = [
  { key: 'totalProducts' as const, label: 'Produk Aktif', sub: 'katalog' },
  { key: 'totalStock' as const, label: 'Stok Tersedia', sub: 'vault' },
  { key: 'pendingOrders' as const, label: 'Perlu Tindakan', sub: 'pending' },
  { key: 'revenue' as const, label: 'Pendapatan', sub: 'paid + delivered' },
]

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
    const safeJson = async <T>(res: Response | null, fallback: T): Promise<T> => {
      if (!res) return fallback
      if (res.status === 204) return fallback
      const text = await res.text().catch(() => '')
      if (!text) return fallback
      try { return JSON.parse(text) as T } catch { return fallback }
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = session ? { Authorization: `Bearer ${session.access_token}` } : {}

      const statsUrl = API_BASE ? `${API_BASE}/api/v1/admin/stats` : '/api/v1/admin/stats'
      const statsP = fetch(statsUrl, { headers }).catch(() => null as unknown as Response)
      const ordersP = authedApiRequest((c) => c.api.v1.admin.orders.$get({ query: {} } as any)).catch(() => null as unknown as Response)
      const productsP = authedApiRequest((c) => c.api.v1.admin.products.$get()).catch(() => null as unknown as Response)

      const [statsRes, ordersRes, productsRes] = await Promise.all([statsP, ordersP, productsP])

      const s = await safeJson<Stats>(statsRes as unknown as Response, { totalProducts: 0, totalStock: 0, pendingOrders: 0, revenue: '0' })
      const o = await safeJson<Order[]>(ordersRes as unknown as Response, [])
      const p = await safeJson<Product[]>(productsRes as unknown as Response, [])

      setStats(s)
      setOrders((Array.isArray(o) ? o : []).slice(0, 5))
      setLowStock((Array.isArray(p) ? p.filter((x) => x.stockCount < 5) : []).slice(0, 5))
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat ringkasan')
      console.error('Overview fetchAll failed', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) {
    return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  }
  if (error) {
    return <div className="bg-white border border-red-200 p-8 text-center"><div className="text-sm font-bold text-red-600">Gagal memuat ringkasan</div><div className="text-xs text-zinc-500 mt-1">{error}</div><button onClick={fetchAll} className="btn btn-sm bg-zinc-900 text-white rounded-sm mt-4">Coba lagi</button></div>
  }

  const values: Record<string, string> = {
    totalProducts: String(stats?.totalProducts ?? 0),
    totalStock: String(stats?.totalStock ?? 0),
    pendingOrders: String(stats?.pendingOrders ?? 0),
    revenue: stats?.revenue ? `Rp ${Number(stats.revenue).toLocaleString('id-ID')}` : 'Rp 0',
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="border-b border-zinc-200 pb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Ringkasan</h1>
          <span className="text-xs font-mono text-zinc-400">: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats: personal, flat, no accent color */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statDefs.map((c) => (
          <div key={c.key} className="bg-white border border-zinc-200 p-5">
            <div className="flex items-start justify-between">
              <div className="text-[10px] font-bold tracking-[0.14em] text-zinc-500 uppercase">{c.label}</div>
              <span className="text-[10px] font-mono text-zinc-400 border border-zinc-200 px-1.5 py-0.5">{c.sub}</span>
            </div>
            <div className="text-[28px] font-black tracking-tight leading-none mt-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{values[c.key]}</div>
            <div className="h-px bg-zinc-100 mt-4" />
          </div>
        ))}
      </div>

      {/* Two panels: clean tables, no AI gloss */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200">
          <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-xs font-bold tracking-[0.12em] uppercase">Pesanan Terbaru</div>
            <span className="text-[11px] font-mono text-zinc-500">{orders.length} entri</span>
          </div>
          {orders.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-sm font-medium">Belum ada pesanan</div>
              <div className="text-xs text-zinc-500 mt-1">Transaksi terbaru akan tercatat di sini.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-[11px] tracking-widest font-semibold text-zinc-500 bg-zinc-50">PRODUK</th>
                    <th className="text-[11px] tracking-widest font-semibold text-zinc-500 bg-zinc-50">JUMLAH</th>
                    <th className="text-[11px] tracking-widest font-semibold text-zinc-500 bg-zinc-50">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                      <td className="text-[13px] font-medium py-3">{o.productName}</td>
                      <td className="text-[13px] font-mono">Rp {Number(o.amount).toLocaleString('id-ID')}</td>
                      <td><span className="text-[11px] font-mono font-semibold tracking-wide px-2 py-1 border border-zinc-200 bg-white">{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-zinc-200">
          <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-xs font-bold tracking-[0.12em] uppercase">Stok Menipis</div>
            <span className="text-[11px] font-mono text-zinc-500">ambang &lt; 5</span>
          </div>
          {lowStock.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-sm font-medium">Stok aman</div>
              <div className="text-xs text-zinc-500 mt-1">Tidak ada produk di bawah ambang.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-[11px] tracking-widest font-semibold text-zinc-500 bg-zinc-50">PRODUK</th>
                    <th className="text-[11px] tracking-widest font-semibold text-zinc-500 bg-zinc-50">SISA</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                      <td className="text-[13px] font-medium py-3">{p.name}</td>
                      <td><span className={`text-[11px] font-mono font-semibold px-2 py-1 border ${p.stockCount === 0 ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-300 text-zinc-700'}`}>{p.stockCount}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
