import { useState, useEffect } from 'react'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import TablePagination from '../../components/admin/TablePagination'
import StatusChip from '../../components/admin/StatusChip'
import { Refresh, Search } from 'iconoir-react'
import { SkeletonRows } from '../../components/admin/TableSkeleton'
import { useTableSort } from '../../hooks/useTableSort'
import TableSortMenu from '../../components/admin/TableSortMenu'

// Shared by DataTable headers (desktop) and TableSortMenu (mobile <sm).
const logColumns = [
  { label: 'WAKTU', sortKey: 'createdAt' },
  { label: 'AKTOR' },
  { label: 'AKSI', sortKey: 'action' },
  { label: 'TEKS' },
]

interface Log {
  id: string
  created_at: string
  actor_email: string | null
  actor_type: 'admin' | 'user' | 'system'
  action: string
  resource_type: string
  resource_public_id: string | null
  resource_name: string | null
  snapshot_text: string
}

function formatIdDate(iso: string) {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = months[d.getMonth()]
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd} ${mon} ${yyyy} ${hh}:${mm}`
}

export default function History() {
  const [type, setType] = useState('all')
  const [actor, setActor] = useState('all')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)

  const { sortKey, sortDir, toggleSort } = useTableSort([], { urlKey: 'sort', defaultKey: 'createdAt', defaultDir: 'desc' })

  const { data, loading, error, fetchedAt, refetch: fetchLogs } = useAdminQuery(async (signal) => {
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) }
    if (type !== 'all') params.type = type
    if (actor !== 'all') params.actor = actor
    if (q) params.q = q
    if (sortKey) { params.sort = sortKey; params.sortDir = sortDir ?? 'desc' }
    const res = await authedApiRequest((c) =>
      (c.api.v1.admin.history as unknown as { $get: (a: { query: Record<string, string> }) => Promise<Response> }).$get({ query: params }), { signal }
    )
    const json = (await res.json()) as { data?: Log[]; total?: number } | Log[]
    // drizzle execute returns different shapes
    if (Array.isArray((json as { data?: unknown }).data)) {
      const d = (json as { data: Log[]; total?: number }).data
      return { logs: d, total: (json as { total?: number }).total ?? d.length }
    } else if (Array.isArray(json)) {
      return { logs: json, total: json.length }
    }
    return { logs: [], total: 0 }
  }, [type, actor, q, offset, limit, sortKey, sortDir], { keepPreviousData: true })
  const logs = data?.logs ?? []
  const total = data?.total ?? 0

  useEffect(() => { setOffset(0) }, [type, actor, q, limit, sortKey, sortDir])

  if (error) return <div className="ad-card-flat p-8 text-center"><div className="text-sm font-semibold text-red-600">Gagal memuat</div><div className="text-xs text-[#6e6e73] mt-1">{error}</div><button onClick={fetchLogs} className="ad-btn ad-btn-dark mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Riwayat</h1>
          {fetchedAt && <p className="text-[13px] text-[#aeaeb2] mt-0.5">Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
        </div>
        <button onClick={fetchLogs} title="Muat ulang" className="ad-btn">
          <Refresh width={15} height={15} strokeWidth={1.5} />
          Muat ulang
        </button>
      </div>

      <div className="ad-card-flat p-3 flex flex-col gap-3">
        <div role="tablist" aria-label="Filter aktor" className="ad-seg self-start max-w-full overflow-x-auto">
          {(['all', 'admin', 'user', 'system'] as const).map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={actor === a}
              onClick={() => setActor(a)}
            >
              {a === 'all' ? 'Semua' : a === 'admin' ? 'Admin' : a === 'user' ? 'User' : 'Sistem'}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="ad-input w-full sm:w-40">
          <option value="all">Semua</option>
          <option value="order">Pesanan</option>
          <option value="stock">Stok</option>
        </select>
        <label className="ad-input flex items-center gap-2 flex-1">
          <Search width={15} height={15} strokeWidth={1.5} className="shrink-0 text-[#aeaeb2]" />
          <input placeholder="public id, teks, aktor..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none" />
        </label>
        </div>
        <div className="flex justify-end">
          <TableSortMenu columns={logColumns} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        </div>
      </div>

      <div className="ad-card">
        <DataTable
          columns={logColumns}
          empty={!loading && logs.length === 0}
          emptyText="Belum ada riwayat."
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
        >
                    {loading ? <SkeletonRows rows={10} cols={4} /> : logs.map((l) => (            <tr key={l.id}>
              <td className="text-xs ad-num whitespace-nowrap text-[#6e6e73]">{formatIdDate(l.created_at)}</td>
              <td className="text-xs ad-num text-[#6e6e73]">{l.actor_email ?? '-'}</td>
              <td><StatusChip>{l.action}</StatusChip></td>
              <td><div className="ad-scrollx text-[13px]" title={l.snapshot_text}>{l.snapshot_text}</div></td>
            </tr>
          ))}
        </DataTable>
        <TablePagination
          total={total}
          limit={limit}
          offset={offset}
          onLimitChange={setLimit}
          onOffsetChange={setOffset}
        />
      </div>
    </div>
  )
}
