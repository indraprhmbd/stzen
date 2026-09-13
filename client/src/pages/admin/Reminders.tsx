import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import TablePagination from '../../components/admin/TablePagination'
import StatusChip from '../../components/admin/StatusChip'
import SlideToggle from '../../components/admin/SlideToggle'
import ToastStack from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { useTableSort } from '../../hooks/useTableSort'
import TableSortMenu from '../../components/admin/TableSortMenu'
import { Refresh, ArrowUpRight, Search } from 'iconoir-react'

// ─── Pengingat ──────────────────────────────────────────────────────────────
// Stateful reminder table. Toggle mirrors Google truth: ON = expiry event
// exists, OFF = deleted. Bulk bar schedules/cancels the page selection.
// Mobile: STATUS/BAYAR columns hide below md (Column.className); sort moves
// to TableSortMenu; filter row and bulk buttons stack full-width.

interface PreviewRow {
  publicId: string
  productName: string
  status: string
  paidAt: string | null
  expiry: string | null
  durationSource: 'snapshot' | 'varian' | null
  reminderState: 'none' | 'scheduled'
  eligible: boolean
  reason: string
}

const columns = [
  { label: '', className: 'w-10' },
  { label: 'ORDER' },
  { label: 'PRODUK', sortKey: 'product' },
  { label: 'STATUS', className: 'hidden md:table-cell' },
  { label: 'BAYAR', sortKey: 'paidAt', className: 'hidden md:table-cell' },
  { label: 'KADALUARSA', sortKey: 'expiry' },
  { label: 'JADWAL', className: 'text-right' },
]

function formatIdDate(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export default function Reminders() {
  const [stateFilter, setStateFilter] = useState<'all' | 'none' | 'scheduled'>('all')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [selected, setSelected] = useState<string[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const { toasts, showToast, dismissToast } = useToast()

  const { sortKey, sortDir, toggleSort } = useTableSort([], { urlKey: 'sort', defaultKey: 'paidAt', defaultDir: 'desc' })

  const { data, loading, error, fetchedAt, refetch } = useAdminQuery(async () => {
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) }
    if (stateFilter !== 'all') params.state = stateFilter
    if (q) params.q = q
    if (sortKey) { params.sort = sortKey; params.sortDir = sortDir ?? 'desc' }
    const res = await authedApiRequest((c) =>
      c.api.v1.admin.reminders.preview.$get({ query: params })
    )
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || `Gagal (${res.status})`)
    }
    return (await res.json()) as { rows: PreviewRow[]; total: number }
  }, [stateFilter, q, offset, limit, sortKey, sortDir])
  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  useEffect(() => { setOffset(0); setSelected([]) }, [stateFilter, q, limit, sortKey, sortDir])

  async function flipRow(row: PreviewRow, turnOn: boolean) {
    if (busyId) return
    setBusyId(row.publicId)
    try {
      const endpoint = (turnOn ? 'schedule' : 'cancel') as 'schedule' | 'cancel'
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.reminders[':id'][endpoint].$post({ param: { id: row.publicId } })
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || `Gagal (${res.status})`)
      }
      showToast(turnOn ? `Pengingat ${row.publicId} aktif` : `Pengingat ${row.publicId} mati`, 'success')
      await refetch()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal mengubah jadwal', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function bulk(action: 'schedule' | 'cancel') {
    if (bulkBusy || selected.length === 0) return
    setBulkBusy(true)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.reminders.bulk.$post({ json: { action, ids: selected.slice(0, 20) } })
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || `Gagal (${res.status})`)
      }
      const out = (await res.json()) as { scheduled: number; scanned: number; skipped: number }
      showToast(
        action === 'schedule'
          ? `Dijadwalkan: ${out.scheduled} dari ${out.scanned}`
          : `Dibatalkan: ${out.scheduled} dari ${out.scanned}`,
        out.skipped > 0 ? 'error' : 'success',
      )
      setSelected([])
      await refetch()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal eksekusi massal', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  const pageIds = rows.map((r) => r.publicId)
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.includes(id))
  function togglePage() {
    setSelected(allChecked ? selected.filter((id) => !pageIds.includes(id)) : [...new Set([...selected, ...pageIds])])
  }

  if (error) return <div className="ad-card-flat p-8 text-center"><div className="text-sm font-semibold text-red-600">Gagal memuat</div><div className="text-xs text-[#6e6e73] mt-1">{error}</div><button onClick={refetch} className="ad-btn ad-btn-dark mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Pengingat</h1>
          {fetchedAt && <p className="text-[13px] text-[#aeaeb2] mt-0.5">Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
        </div>
        <button onClick={refetch} title="Muat ulang" className="ad-btn">
          <Refresh width={15} height={15} strokeWidth={1.5} />
          Muat ulang
        </button>
      </div>

      <div className="ad-card-flat p-3 flex flex-col gap-3">
        <div role="tablist" aria-label="Filter status jadwal" className="ad-seg self-start max-w-full overflow-x-auto">
          {(['all', 'none', 'scheduled'] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={stateFilter === s}
              onClick={() => setStateFilter(s)}
            >
              {s === 'all' ? 'Semua' : s === 'none' ? 'Belum' : 'Terjadwal'}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="ad-input flex items-center gap-2 flex-1">
            <Search width={15} height={15} strokeWidth={1.5} className="shrink-0 text-[#aeaeb2]" />
            <input placeholder="order id, produk..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none" />
          </label>
        </div>
        <div className="flex justify-end">
          <TableSortMenu columns={columns} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        </div>
      </div>

      {selected.length > 0 && (
        <div className="ad-card p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <span className="text-[13px] font-semibold text-[#1d1d1f] sm:mr-auto">{selected.length} dipilih</span>
          <button onClick={() => bulk('schedule')} disabled={bulkBusy} className="ad-btn ad-btn-dark w-full sm:w-auto">
            {bulkBusy ? 'Memproses...' : `Jadwalkan (${selected.length})`}
          </button>
          <button onClick={() => bulk('cancel')} disabled={bulkBusy} className="ad-btn w-full sm:w-auto">
            Batalkan
          </button>
          <button onClick={() => setSelected([])} className="ad-btn w-full sm:w-auto">Bersihkan</button>
        </div>
      )}

      <ToastStack toasts={toasts} onDone={dismissToast} />

      <div className="ad-card">
        <DataTable
          columns={columns}
          empty={!loading && rows.length === 0}
          emptyText="Belum ada order pada filter ini."
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
        >
          {rows.map((r) => {
            const on = r.reminderState === 'scheduled'
            const rowBusy = busyId === r.publicId
            const isSelected = selected.includes(r.publicId)
            function toggleSelect() {
              setSelected(isSelected ? selected.filter((id) => id !== r.publicId) : [...selected, r.publicId])
            }
            return (
              <tr
                key={r.publicId}
                onClick={(e) => {
                  // Row-body select: ignore clicks on interactive children
                  // (order link, checkbox, toggle) so they keep their own actions.
                  if ((e.target as HTMLElement).closest('a,input,button,label')) return
                  toggleSelect()
                }}
                className={`cursor-pointer ${isSelected ? 'bg-[#f5f5f7]' : ''}`}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Pilih ${r.publicId}`}
                    className="checkbox checkbox-sm"
                    checked={isSelected}
                    onChange={toggleSelect}
                  />
                </td>
                <td>
                  <Link
                    to={`/admin/orders?status=semua&q=${encodeURIComponent(r.publicId)}`}
                    title={`Buka ${r.publicId} di Pesanan (tab Semua)`}
                    className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#1d1d1f] hover:underline"
                  >
                    {r.publicId}
                    <ArrowUpRight width={13} height={13} strokeWidth={2} className="text-[#aeaeb2]" />
                  </Link>
                </td>
                <td className="text-[13px]">{r.productName}</td>
                <td className="hidden md:table-cell"><StatusChip status={r.status}>{r.status}</StatusChip></td>
                <td className="hidden md:table-cell text-[13px]">{formatIdDate(r.paidAt)}</td>
                <td
                  className="text-[13px]"
                  title={r.durationSource === 'varian' ? 'Durasi dari varian saat ini (order lama tanpa snapshot)' : undefined}
                >
                  {formatIdDate(r.expiry)}{r.durationSource === 'varian' ? ' *' : ''}
                </td>
                <td className="text-right">
                  <span title={r.reason} className="inline-flex justify-end">
                    <SlideToggle
                      checked={on}
                      busy={rowBusy}
                      disabled={!r.eligible && !on}
                      label={`Pengingat ${r.publicId} ${on ? 'aktif' : 'mati'}. ${r.reason}`}
                      onChange={(next) => flipRow(r, next)}
                    />
                  </span>
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
        />
      </div>
    </div>
  )
}
