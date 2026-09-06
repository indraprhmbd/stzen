import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import StatCard from '../../components/admin/StatCard'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/admin/StatusChip'
import CopyCell from '../../components/admin/CopyCell'
import { SkeletonRows, SkeletonCards } from '../../components/admin/TableSkeleton'
import { Refresh, Cube, Archive, ShoppingBag, GraphUp, Plus } from 'iconoir-react'
import { AreaChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Area } from 'recharts'

interface Stats {
  totalProducts: number
  totalStock: number
  pendingOrders: number
  revenue: string
}

interface Order {
  id: string
  productName: string
  customerEmail: string | null
  amount: string
  status: string
  createdAt: string
}

interface LowStockVariant {
  id: string
  name: string
  sku: string
  product_name: string
  stock_count: number
}

function formatAge(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}j ${mins % 60}m`
  return `${Math.floor(hours / 24)}h ${hours % 24}j`
}

const statDefs = [
  { key: 'totalProducts' as const, label: 'Produk Aktif', sub: 'katalog', icon: Cube },
  { key: 'totalStock' as const, label: 'Stok Tersedia', sub: 'vault', icon: Archive },
  { key: 'pendingOrders' as const, label: 'Perlu Tindakan', sub: 'pending', icon: ShoppingBag },
  { key: 'revenue' as const, label: 'Pendapatan', sub: 'paid + delivered', icon: GraphUp },
]

const pieColors: Record<string, string> = { PENDING: '#d97706', PAID: '#3b82f6', DELIVERED: '#16a34a', REJECTED: '#dc2626', REFUNDED: '#7c3aed' }

const ranges = [['7d', '7 hari'], ['30d', '30 hari'], ['90d', '90 hari']] as const

const tooltipStyle = { fontSize: 12, border: '1px solid #e8e8ed', borderRadius: 10, boxShadow: '0 8px 24px rgb(0 0 0 / 0.08)' }

export default function Overview() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')
  const navigate = useNavigate()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const rangeLabel = range === '7d' ? '7 hari' : range === '90d' ? '90 hari' : '30 hari'
  const { data, loading, error, fetchedAt, refetch: fetchAll } = useAdminQuery(async () => {
    const [statsRes, analyticsRes, ordersRes, lowStockRes] = await Promise.all([
      authedApiRequest((c) => c.api.v1.admin.stats.$get()),
      authedApiRequest((c) => c.api.v1.admin.analytics.$get({ query: { range } })),
      authedApiRequest((c) => c.api.v1.admin.orders.$get({ query: { limit: '5', status: 'PENDING,PAID', oldest: '1' } })),
      authedApiRequest((c) => c.api.v1.admin.stats['low-stock'].$get({ query: { threshold: '5', limit: '5' } })),
    ])

    const s = (await statsRes.json()) as Stats
    const a = (await analyticsRes.json()) as unknown as { dailySales: unknown[]; byStatus: unknown[]; byCategory: unknown[]; topProducts: unknown[] }
    const o = (await ordersRes.json()) as { orders: Order[] }
    const ls = (await lowStockRes.json()) as LowStockVariant[]

    return {
      stats: s,
      analytics: a,
      orders: (Array.isArray(o.orders) ? o.orders : []).slice(0, 5),
      lowStock: Array.isArray(ls) ? ls.slice(0, 5) : [],
    }
  }, [range])
  const stats = data?.stats ?? null
  const analytics = data?.analytics ?? null

  // Derived lists memoized so recharts trees skip re-render on unrelated state
  const orders = useMemo(() => data?.orders ?? [], [data])
  const lowStock = useMemo(() => data?.lowStock ?? [], [data])
  const dailySales = useMemo(() => analytics?.dailySales ?? [], [analytics])
  const byCategory = useMemo(() => analytics?.byCategory ?? [], [analytics])
  const topProducts = useMemo(() => analytics?.topProducts ?? [], [analytics])
  const byStatus = useMemo(() => (analytics?.byStatus ?? []) as { status: string; count: number }[], [analytics])

  async function approve(orderId: string) {
    setActionLoading(orderId)
    try {
      const res = await authedApiRequest(
        (c) => c.api.v1.admin.orders[':id'].approve.$post({ param: { id: orderId } }),
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      )
      if (!res.ok) return
      await fetchAll()
    } finally {
      setActionLoading(null)
    }
  }

  if (error) return <div className="ad-card-flat p-8 text-center"><div className="text-sm font-semibold text-red-600">Gagal memuat ringkasan</div><div className="text-xs text-[#6e6e73] mt-1">{error}</div><button onClick={fetchAll} className="ad-btn ad-btn-dark mt-4">Coba lagi</button></div>

  const values: Record<string, string> = {
    totalProducts: String(stats?.totalProducts ?? 0),
    totalStock: String(stats?.totalStock ?? 0),
    pendingOrders: String(stats?.pendingOrders ?? 0),
    revenue: stats?.revenue ? `Rp ${Number(stats.revenue).toLocaleString('id-ID')}` : 'Rp 0',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Ringkasan</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5 ad-num">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}{fetchedAt && <span className="text-[#aeaeb2]"> · Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Rentang" className="ad-seg">
            {ranges.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={range === key} onClick={() => setRange(key)}>{label}</button>
            ))}
          </div>
          <button onClick={fetchAll} title="Muat ulang" className="ad-btn">
            <Refresh width={15} height={15} strokeWidth={1.5} />
            Muat ulang
          </button>
        </div>
      </div>

      {loading ? <SkeletonCards count={4} /> : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statDefs.map((c) => (
          <StatCard key={c.key} value={values[c.key]} label={c.label} sub={c.sub} icon={c.icon} />
        ))}
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Penjualan {rangeLabel}</div>
            <span className="ad-card-hint ad-num">pesanan</span>
          </div>
          <div className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySales} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f1f1f4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#1d1d1f" fill="#1d1d1f" fillOpacity={0.06} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Pendapatan {rangeLabel}</div>
            <span className="ad-card-hint ad-num">Rp</span>
          </div>
          <div className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySales} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f1f1f4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`Rp ${Number(v).toLocaleString('id-ID')}`, 'revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#1d1d1f" fill="#1d1d1f" fillOpacity={0.06} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Stok per kategori</div>
            <span className="ad-card-hint">vault</span>
          </div>
          <div className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid stroke="#f1f1f4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="stock" fill="#1d1d1f" radius={[4, 4, 4, 4]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Top 5 produk {rangeLabel}</div>
            <span className="ad-card-hint">terlaris</span>
          </div>
          <div className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid stroke="#f1f1f4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#1d1d1f" radius={[4, 4, 4, 4]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {byStatus.length ? (
        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Pesanan per status</div>
          </div>
          <div className="h-[160px] flex items-center gap-4 px-4">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byStatus} dataKey="count" nameKey="status" innerRadius={45} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                    {byStatus.map((e, i) => (
                      <Cell key={i} fill={pieColors[e.status] ?? '#aeaeb2'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2">
              {byStatus.map((s) => (
                <StatusChip key={s.status} status={s.status}>{s.status} {s.count}</StatusChip>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Butuh Tindakan</div>
            <span className="ad-card-hint ad-num">{orders.length} antre</span>
          </div>
          {loading ? (
            <DataTable columns={[{ label: 'UMUR' }, { label: 'PRODUK' }, { label: 'PELANGGAN' }, { label: 'JUMLAH' }, { label: 'AKSI', className: 'text-right' }]} empty={false}>
              <SkeletonRows rows={3} cols={5} />
            </DataTable>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm font-medium">Antrian kosong</div>
              <div className="text-xs text-[#6e6e73] mt-1">Tidak ada pesanan menunggu tindakan.</div>
            </div>
          ) : (
            <DataTable columns={[{ label: 'UMUR' }, { label: 'PRODUK' }, { label: 'PELANGGAN' }, { label: 'JUMLAH' }, { label: 'AKSI', className: 'text-right' }]} empty={false}>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="text-xs ad-num whitespace-nowrap text-[#6e6e73]">{formatAge(o.createdAt)}</td>
                  <td className="text-[13px] font-medium max-w-[160px] truncate" title={o.productName}>{o.productName}</td>
                  <td className="text-xs ad-num text-[#6e6e73] max-w-[140px] truncate" title={o.customerEmail ?? '-'}>{o.customerEmail ?? '-'}</td>
                  <td className="text-[13px] ad-num">Rp {Number(o.amount).toLocaleString('id-ID')}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {o.status === 'PENDING' && (
                        <button disabled={actionLoading === o.id} onClick={() => approve(o.id)} className="ad-btn ad-btn-dark">Setujui</button>
                      )}
                      <button onClick={() => navigate('/admin/orders')} className="ad-btn">Buka</button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          <button onClick={() => navigate('/admin/orders')} className="w-full px-4 py-2.5 text-center text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] border-t border-[#f1f1f4]">Lihat semua antrean</button>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Stok Menipis</div>
            <span className="ad-card-hint ad-num">ambang &lt; 5</span>
          </div>
          {loading ? (
            <DataTable columns={[{ label: 'VARIAN' }, { label: 'SISA' }, { label: 'AKSI', className: 'text-right' }]} empty={false}>
              <SkeletonRows rows={3} cols={3} />
            </DataTable>
          ) : lowStock.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm font-medium">Stok aman</div>
              <div className="text-xs text-[#6e6e73] mt-1">Tidak ada varian di bawah ambang.</div>
            </div>
          ) : (
            <DataTable columns={[{ label: 'VARIAN' }, { label: 'SISA' }, { label: 'AKSI', className: 'text-right' }]} empty={false}>
              {lowStock.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="text-[13px] font-medium">{p.name}</div>
                    <div className="text-[11px] text-[#6e6e73]">{p.product_name} · <CopyCell value={p.sku} className="ad-num" /></div>
                  </td>
                  <td><StatusChip tone={p.stock_count === 0 ? 'red' : 'amber'}>{p.stock_count}</StatusChip></td>
                  <td className="text-right">
                    <button onClick={() => navigate(`/admin/products?tab=stok&variant=${p.id}&import=1`)} className="ad-btn ad-btn-dark"><Plus width={14} height={14} strokeWidth={1.5} />Tambah</button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          <button onClick={() => navigate('/admin/products?tab=stok')} className="w-full px-4 py-2.5 text-center text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] border-t border-[#f1f1f4]">Kelola stok</button>
        </div>
      </div>
    </div>
  )
}
