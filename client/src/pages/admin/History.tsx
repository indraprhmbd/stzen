import { useState, useEffect } from 'react'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/admin/StatusChip'

interface Log {
  id: string
  created_at: string
  actor_email: string | null
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
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 20

  const { data, loading, error, fetchedAt, refetch: fetchLogs } = useAdminQuery(async () => {
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) }
    if (type !== 'all') params.type = type
    if (q) params.q = q
    const res = await authedApiRequest((c) =>
      (c.api.v1.admin.history as unknown as { $get: (a: { query: Record<string, string> }) => Promise<Response> }).$get({ query: params })
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
  }, [type, q, offset])
  const logs = data?.logs ?? []
  const total = data?.total ?? 0

  useEffect(() => { setOffset(0) }, [type, q])

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  if (error) return <div className="bg-white border border-red-200 p-8 text-center"><div className="text-sm font-bold text-red-600">Gagal memuat</div><div className="text-xs text-zinc-500 mt-1">{error}</div><button onClick={fetchLogs} className="btn btn-sm bg-zinc-900 text-white rounded-sm mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-zinc-200 pb-5">
        <h1 className="text-[22px] font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Riwayat</h1>
        <p className="text-sm text-zinc-500 mt-1">Catatan immutable pesanan dan impor stok. Teks tidak terhubung dinamis.{fetchedAt && <span className="font-mono text-zinc-400"> Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}</p>
      </div>

      <div className="bg-white border border-zinc-200 p-3 flex flex-col sm:flex-row gap-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="border border-zinc-200 bg-white px-3 py-2 text-sm font-mono w-full sm:w-40">
          <option value="all">Semua</option>
          <option value="order">Pesanan</option>
          <option value="stock">Stok</option>
        </select>
        <label className="flex items-center gap-2 flex-1 border border-zinc-200 px-3 py-2 bg-zinc-50">
          <span className="text-[11px] font-bold tracking-widest text-zinc-400">CARI</span>
          <input placeholder="public id, teks, aktor..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none placeholder:text-zinc-400" />
        </label>
      </div>

      <div className="bg-white border border-zinc-200 overflow-hidden">
        <DataTable
          columns={[{ label: 'WAKTU' }, { label: 'AKTOR' }, { label: 'AKSI' }, { label: 'TEKS' }]}
          empty={logs.length === 0}
          emptyText="Belum ada riwayat."
        >
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
              <td className="text-xs font-mono whitespace-nowrap py-3">{formatIdDate(l.created_at)}</td>
              <td className="text-xs font-mono text-zinc-600">{l.actor_email ?? '-'}</td>
              <td><StatusChip>{l.action}</StatusChip></td>
              <td className="text-[13px] max-w-[420px] truncate" title={l.snapshot_text}>{l.snapshot_text}</td>
            </tr>
          ))}
        </DataTable>
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50">
          <span className="text-xs font-mono text-zinc-500">{total} entri</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))} className="text-xs border border-zinc-200 bg-white px-3 py-1 disabled:opacity-40">Sebelumnya</button>
            <button disabled={offset + limit >= total} onClick={() => setOffset((o) => o + limit)} className="text-xs border border-zinc-200 bg-white px-3 py-1 disabled:opacity-40">Selanjutnya</button>
          </div>
        </div>
      </div>
    </div>
  )
}
