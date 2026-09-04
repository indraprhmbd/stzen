import { useState } from 'react'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import StatCard from '../../components/admin/StatCard'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/admin/StatusChip'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'

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

const pieColors: Record<string, string> = { PENDING: '#f59e0b', PAID: '#3b82f6', DELIVERED: '#10b981', REJECTED: '#ef4444' }

export default function Overview() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')
  const rangeLabel = range === '7d' ? '7 hari' : range === '90d' ? '90 hari' : '30 hari'
  const { data, loading, error, fetchedAt, refetch: fetchAll } = useAdminQuery(async () => {
    const [statsRes, analyticsRes, ordersRes, productsRes] = await Promise.all([
      authedApiRequest((c) => c.api.v1.admin.stats.$get()),
      authedApiRequest((c) => c.api.v1.admin.analytics.$get({ query: { range } })),
      authedApiRequest((c) => c.api.v1.admin.orders.$get({ query: { limit: '5' } })),
      authedApiRequest((c) => c.api.v1.admin.products.$get()),
    ])

    const s = (await statsRes.json()) as Stats
    const a = (await analyticsRes.json()) as { dailySales: unknown[]; byStatus: unknown[]; byCategory: unknown[]; topProducts: unknown[] }
    const o = (await ordersRes.json()) as { orders: Order[] }
    const p = (await productsRes.json()) as Product[]

    return {
      stats: s,
      analytics: a,
      orders: (Array.isArray(o.orders) ? o.orders : []).slice(0, 5),
      lowStock: (Array.isArray(p) ? p.filter((x) => x.stockCount < 5) : []).slice(0, 5),
    }
  }, [range])
  const stats = data?.stats ?? null
  const analytics = data?.analytics ?? null
  const orders = data?.orders ?? []
  const lowStock = data?.lowStock ?? []

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  if (error) return <div className="bg-white border border-red-200 p-8 text-center"><div className="text-sm font-bold text-red-600">Gagal memuat ringkasan</div><div className="text-xs text-zinc-500 mt-1">{error}</div><button onClick={fetchAll} className="btn btn-sm bg-zinc-900 text-white rounded-sm mt-4">Coba lagi</button></div>

  const values: Record<string, string> = {
    totalProducts: String(stats?.totalProducts ?? 0),
    totalStock: String(stats?.totalStock ?? 0),
    pendingOrders: String(stats?.pendingOrders ?? 0),
    revenue: stats?.revenue ? `Rp ${Number(stats.revenue).toLocaleString('id-ID')}` : 'Rp 0',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-zinc-200 pb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[22px] font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Ringkasan</h1>
          <span className="text-xs font-mono text-zinc-400">: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          {fetchedAt && <span className="text-[11px] font-mono text-zinc-400">· Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as '7d' | '30d' | '90d')} className="border border-zinc-200 bg-white px-3 py-1.5 text-xs font-mono">
          <option value="7d">7 hari</option>
          <option value="30d">30 hari</option>
          <option value="90d">90 hari</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statDefs.map((c) => (
          <StatCard key={c.key} value={values[c.key]} label={c.label} sub={c.sub} />
        ))}
      </div>

      {/* Dense diagrams, no wasted space */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-zinc-200">
          <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Penjualan {rangeLabel}</div>
            <span className="text-[10px] font-mono text-zinc-500">pesanan</span>
          </div>
          <div className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.dailySales ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', border: '1px solid #e4e4e7' }} />
                <Line type="monotone" dataKey="count" stroke="#18181b" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-zinc-200">
          <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Pendapatan {rangeLabel}</div>
            <span className="text-[10px] font-mono text-zinc-500">Rp</span>
          </div>
          <div className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.dailySales ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', border: '1px solid #e4e4e7' }} formatter={(v: any) => [`Rp ${Number(v).toLocaleString('id-ID')}`, 'revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#18181b" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-zinc-200">
          <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Stok per kategori</div>
            <span className="text-[10px] font-mono text-zinc-500">vault</span>
          </div>
          <div className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.byCategory ?? []} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid stroke="#f4f4f5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', border: '1px solid #e4e4e7' }} />
                <Bar dataKey="stock" fill="#18181b" radius={[2, 2, 2, 2]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-zinc-200">
          <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Top 5 produk {rangeLabel}</div>
            <span className="text-[10px] font-mono text-zinc-500">terlaris</span>
          </div>
          <div className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.topProducts ?? []} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid stroke="#f4f4f5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', border: '1px solid #e4e4e7' }} />
                <Bar dataKey="count" fill="#18181b" radius={[2, 2, 2, 2]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Status donut compact */}
      {analytics?.byStatus?.length ? (
        <div className="bg-white border border-zinc-200">
          <div className="px-4 py-2 border-b border-zinc-200">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Pesanan per status</div>
          </div>
          <div className="h-[160px] flex items-center gap-4 px-4">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.byStatus} dataKey="count" nameKey="status" innerRadius={45} outerRadius={65} paddingAngle={2}>
                    {analytics.byStatus.map((e: any, i: number) => (
                      <Cell key={i} fill={pieColors[e.status] ?? '#71717a'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', border: '1px solid #e4e4e7' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {analytics.byStatus.map((s: any) => (
                <span key={s.status} className="border border-zinc-200 px-2 py-1 text-[11px]"><span className="inline-block w-2 h-2 mr-1.5" style={{ background: pieColors[s.status] ?? '#71717a' }}></span>{s.status} {s.count}</span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-zinc-200">
          <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Pesanan Terbaru</div>
            <span className="text-[10px] font-mono text-zinc-500">{orders.length} entri</span>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm font-medium">Belum ada pesanan</div>
              <div className="text-xs text-zinc-500 mt-1">Transaksi terbaru akan tercatat di sini.</div>
            </div>
          ) : (
            <DataTable columns={[{ label: 'PRODUK' }, { label: 'JUMLAH' }, { label: 'STATUS' }]} empty={false}>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                  <td className="text-[13px] font-medium py-2.5">{o.productName}</td>
                  <td className="text-[13px] font-mono">Rp {Number(o.amount).toLocaleString('id-ID')}</td>
                  <td><StatusChip status={o.status}>{o.status}</StatusChip></td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>

        <div className="bg-white border border-zinc-200">
          <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Stok Menipis</div>
            <span className="text-[10px] font-mono text-zinc-500">ambang &lt; 5</span>
          </div>
          {lowStock.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm font-medium">Stok aman</div>
              <div className="text-xs text-zinc-500 mt-1">Tidak ada produk di bawah ambang.</div>
            </div>
          ) : (
            <DataTable columns={[{ label: 'PRODUK' }, { label: 'SISA' }]} empty={false}>
              {lowStock.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                  <td className="text-[13px] font-medium py-2.5">{p.name}</td>
                  <td><StatusChip tone={p.stockCount === 0 ? 'dark' : 'zinc'}>{p.stockCount}</StatusChip></td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      </div>
    </div>
  )
}
