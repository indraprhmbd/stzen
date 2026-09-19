import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import StatCard from '../../components/admin/StatCard'
import DataTable from '../../components/admin/DataTable'
import TablePagination from '../../components/admin/TablePagination'
import StatusChip from '../../components/admin/StatusChip'
import CopyCell from '../../components/admin/CopyCell'
import { SkeletonRows, SkeletonCards } from '../../components/admin/TableSkeleton'
import { Refresh, Cube, Archive, ShoppingBag, GraphUp, Plus, Eye, EyeClosed } from 'iconoir-react'
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
  { key: 'totalProducts' as const, label: 'Produk Aktif', sub: 'katalog', icon: Cube, to: '/admin/products' },
  { key: 'totalStock' as const, label: 'Stok Tersedia', sub: 'vault', icon: Archive, to: '/admin/products?tab=stok' },
  { key: 'pendingOrders' as const, label: 'Perlu Tindakan', sub: 'pending', icon: ShoppingBag, to: '/admin/orders' },
  { key: 'totalOrders' as const, label: 'Pesanan', sub: 'rentang', icon: GraphUp, to: '/admin/orders?status=semua' },
]

const pieColors: Record<string, string> = { PENDING: '#d97706', PAID: '#3b82f6', DELIVERED: '#16a34a', REJECTED: '#dc2626', REFUNDED: '#7c3aed' }

const ranges = [['1d', '1 hari'], ['7d', '7 hari'], ['30d', '30 hari'], ['90d', '90 hari']] as const

const tooltipStyle = { fontSize: 12, border: '1px solid #e8e8ed', borderRadius: 10, boxShadow: '0 8px 24px rgb(0 0 0 / 0.08)' }

export default function Overview() {
  const [range, setRange] = useState<'1d' | '7d' | '30d' | '90d'>('30d')
  // Low-stock widget owns its paging: full under-threshold set, 5 per page,
  // SISA sorted server-side (asc = most urgent first). Threshold itself is
  // NOT sent - the server falls back to ops.low_threshold from Settings.
  const [lsPage, setLsPage] = useState(1)
  const [lsDir, setLsDir] = useState<'asc' | 'desc'>('asc')
  const LS_LIMIT = 5
  function toggleLsSort() {
    setLsDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    setLsPage(1)
  }
  const navigate = useNavigate()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showRevenue, setShowRevenue] = useState(() => {
    const stored = localStorage.getItem('admin:showRevenue')
    return stored ? stored === 'true' : true
  })

  useEffect(() => {
    localStorage.setItem('admin:showRevenue', String(showRevenue))
  }, [showRevenue])
  // Mount charts after first paint: ResponsiveContainer measures its parent
  // on mount, and a pre-paint zero-size measurement leaves Opera blank.
  // Numeric heights match the fixed wrappers (164 = h-[180px] minus p-2).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const rangeLabel = range === '1d' ? '1 hari' : range === '7d' ? '7 hari' : range === '90d' ? '90 hari' : '30 hari'
  const { data, loading, error, fetchedAt, refetch: fetchAll } = useAdminQuery(async () => {
    // Composite: one round trip (stats + analytics + recent orders +
    // low-stock). Server guarantees the shape; normalize defensively.
    const res = await authedApiRequest((c) => c.api.v1.admin.overview.$get({ query: { range } }))
    const j = (await res.json()) as {
      stats: Stats
      analytics: { dailySales: unknown[]; byStatus: unknown[]; byCategory: unknown[]; topProducts: unknown[] }
      orders: Order[]
    }

    return {
      stats: j.stats,
      analytics: j.analytics,
      orders: (Array.isArray(j.orders) ? j.orders : []).slice(0, 5),
    }
  }, [range])
  // Separate query so widget paging/sorting never refetches tiles+charts.
  const { data: lsData, loading: lsLoading } = useAdminQuery(async () => {
    const res = await authedApiRequest((c) => c.api.v1.admin.stats['low-stock'].$get({
      query: { page: String(lsPage), limit: String(LS_LIMIT), sortDir: lsDir },
    }))
    const j = (await res.json()) as {
      rows: LowStockVariant[]
      outOfStock: number
      runningLow: number
      total: number
      page: number
      limit: number
      totalPages: number
      byProduct: { product_name: string; count: number }[]
    }
    return {
      rows: Array.isArray(j.rows) ? j.rows : [],
      out: j.outOfStock ?? 0,
      low: j.runningLow ?? 0,
      total: j.total ?? 0,
      totalPages: j.totalPages ?? 1,
      byProduct: Array.isArray(j.byProduct) ? j.byProduct : [],
    }
  }, [lsPage, lsDir])
  const stats = data?.stats ?? null
  const analytics = data?.analytics ?? null

  // Derived lists memoized so recharts trees skip re-render on unrelated state
  const orders = useMemo(() => data?.orders ?? [], [data])
  const lowStock = useMemo(() => lsData?.rows ?? [], [lsData])
  const stockSummary = useMemo(() => ({ out: lsData?.out ?? 0, low: lsData?.low ?? 0 }), [lsData])
  const lsTotal = lsData?.total ?? 0
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
    totalOrders: String(byStatus.reduce((s, e) => s + (e.count ?? 0), 0)),
  }
  const revenueText = showRevenue && stats?.revenue ? `Rp ${Number(stats.revenue).toLocaleString('id-ID')}` : '*****'

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

      {loading ? (
        <>
          <div className="ad-card-flat p-4"><div className="h-9 w-2/3 animate-pulse rounded-[8px] bg-[#f1f1f4]" /></div>
          <SkeletonCards count={4} />
        </>
      ) : (
      <>
      <button
        onClick={() => navigate('/admin/orders?status=semua')}
        className="ad-card-flat w-full p-4 sm:p-5 flex items-center gap-3 text-left transition-colors hover:border-[#d1d1d6]"
      >
        <span className="ad-squircle">
          <GraphUp width={24} height={24} strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[26px] sm:text-[34px] font-semibold leading-none tracking-tight ad-num break-words">{revenueText}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setShowRevenue((s) => !s) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setShowRevenue((s) => !s) } }}
              title={showRevenue ? 'Sembunyikan pendapatan' : 'Tampilkan pendapatan'}
              aria-label={showRevenue ? 'Sembunyikan pendapatan' : 'Tampilkan pendapatan'}
              aria-pressed={showRevenue}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
            >
              {showRevenue
                ? <Eye width={16} height={16} strokeWidth={1.5} />
                : <EyeClosed width={16} height={16} strokeWidth={1.5} />}
            </span>
          </span>
          <span className="block text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1.5">
            Pendapatan
            <span className="text-[#aeaeb2] normal-case font-normal ml-1">paid + delivered · {rangeLabel}</span>
          </span>
        </span>
      </button>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statDefs.map((c) => (
          <StatCard
            key={c.key}
            value={values[c.key] ?? ''}
            label={c.label}
            sub={c.key === 'totalOrders' ? rangeLabel : c.sub}
            icon={c.icon}
            onNavigate={() => navigate(c.to)}
          />
        ))}
      </div>
      </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Penjualan {rangeLabel}</div>
            <span className="ad-card-hint ad-num">pesanan</span>
          </div>
          <div className="h-[180px] p-2">
            {mounted && (
            <ResponsiveContainer width="100%" height={164}>
              <AreaChart data={dailySales} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f1f1f4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#1d1d1f" fill="#1d1d1f" fillOpacity={0.06} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Pendapatan {rangeLabel}</div>
            <span className="ad-card-hint ad-num">Rp</span>
          </div>
          <div className="h-[180px] p-2">
            {mounted && (
            <ResponsiveContainer width="100%" height={164}>
              <AreaChart data={dailySales} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f1f1f4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`Rp ${Number(v).toLocaleString('id-ID')}`, 'revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#1d1d1f" fill="#1d1d1f" fillOpacity={0.06} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Stok per kategori</div>
            <span className="ad-card-hint">vault</span>
          </div>
          <div className="h-[180px] p-2">
            {mounted && (
            <ResponsiveContainer width="100%" height={164}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid stroke="#f1f1f4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="stock" fill="#1d1d1f" radius={[4, 4, 4, 4]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Top 5 produk {rangeLabel}</div>
            <span className="ad-card-hint">terlaris</span>
          </div>
          <div className="h-[180px] p-2">
            {mounted && (
            <ResponsiveContainer width="100%" height={164}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid stroke="#f1f1f4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#1d1d1f" radius={[4, 4, 4, 4]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {byStatus.length ? (
        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Pesanan per status</div>
          </div>
          <div className="h-[160px] flex items-center gap-4 px-4">
            <div className="h-[140px] w-[140px] shrink-0">
              {mounted && (
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={byStatus} dataKey="count" nameKey="status" innerRadius={45} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                    {byStatus.map((e, i) => (
                      <Cell key={i} fill={pieColors[e.status] ?? '#aeaeb2'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              )}
            </div>
            <div className="flex flex-col items-start gap-2">
              {byStatus.map((s) => (
                <StatusChip key={s.status} status={s.status}>{s.status} {s.count}</StatusChip>
              ))}
            </div>
          </div>
        </div>
      ) : null}
        <div className="ad-card">
          <div className="ad-card-head">
            <div className="ad-card-title">Varian Habis</div>
            <span className="ad-card-hint ad-num">{stockSummary.low} menipis</span>
          </div>
          <div className="px-4 py-3 flex items-end gap-2">
            <span className="ad-num text-4xl font-black leading-none">{lsLoading ? '…' : stockSummary.out}</span>
            <span className="text-xs text-[#6e6e73] pb-1">varian tak bisa dibeli</span>
          </div>
          {!lsLoading && (lsData?.byProduct ?? []).length > 0 && (
            <div className="px-4 pb-2 flex flex-col">
              {(lsData?.byProduct ?? []).slice(0, 5).map((g) => (
                <div
                  key={g.product_name}
                  className="flex items-center justify-between gap-2 py-1.5 border-t border-[#f1f1f4]"
                >
                  <span className="text-xs font-medium truncate">{g.product_name}</span>
                  <span className="ad-num text-[11px] font-semibold text-[#6e6e73] shrink-0">{g.count} habis</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/admin/products?tab=stok')} className="w-full px-4 py-2.5 text-center text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] border-t border-[#f1f1f4]">Kelola stok</button>
        </div>
      </div>

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
          </div>
          {lsLoading ? (
            <DataTable columns={[{ label: 'VARIAN' }, { label: 'SISA' }, { label: 'AKSI', className: 'text-right' }]} empty={false}>
              <SkeletonRows rows={3} cols={3} />
            </DataTable>
          ) : lsTotal === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm font-medium">Stok aman</div>
              <div className="text-xs text-[#6e6e73] mt-1">Tidak ada varian di bawah ambang.</div>
            </div>
          ) : (
            <>
              <DataTable
                columns={[{ label: 'VARIAN' }, { label: 'SISA', sortKey: 'sisa' }, { label: 'AKSI', className: 'text-right' }]}
                empty={false}
                sortKey="sisa"
                sortDir={lsDir}
                onSort={toggleLsSort}
              >
                {lowStock.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {/* Single wrapper: mobile card layout is flex-row, so the
                          two lines need one parent to stack + right-align. */}
                      <div className="max-sm:text-right">
                        <div className="text-[13px] font-medium">{p.name}</div>
                        <div className="text-[11px] text-[#6e6e73]">{p.product_name} · <CopyCell value={p.sku} className="ad-num" /></div>
                      </div>
                    </td>
                    <td><StatusChip tone={p.stock_count === 0 ? 'red' : 'amber'}>{p.stock_count}</StatusChip></td>
                    <td className="text-right">
                      <button onClick={() => navigate(`/admin/products?tab=stok&variant=${p.id}&import=1`)} className="ad-btn"><Plus width={14} height={14} strokeWidth={1.5} />Tambah</button>
                    </td>
                  </tr>
                ))}
              </DataTable>
              {lsTotal > LS_LIMIT && (
                <TablePagination
                  total={lsTotal}
                  limit={LS_LIMIT}
                  offset={(lsPage - 1) * LS_LIMIT}
                  onLimitChange={() => {}}
                  onOffsetChange={(offset) => setLsPage(Math.floor(offset / LS_LIMIT) + 1)}
                  unit="varian"
                />
              )}
            </>
          )}
          <button onClick={() => navigate('/admin/products?tab=stok')} className="w-full px-4 py-2.5 text-center text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] border-t border-[#f1f1f4]">Kelola stok</button>
        </div>
      </div>
    </div>
  )
}
