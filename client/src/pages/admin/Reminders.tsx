import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import TablePagination from '../../components/admin/TablePagination'
import StatusChip from '../../components/admin/StatusChip'
import SlideToggle from '../../components/admin/SlideToggle'
import AdminToastStack from '../../components/admin/AdminToast'
import { useToast } from '../../hooks/useToast'
import { useRowSelection } from '../../hooks/useRowSelection'
import { SelectableRow, SelectAllCheckbox } from '../../components/admin/RowSelection'
import AdminBulkBar from '../../components/admin/AdminBulkBar'
import { useAdminTableParams } from '../../hooks/useAdminTableParams'
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
  { label: 'ORDER' },
  { label: 'PRODUK', sortKey: 'product' },
  { label: 'STATUS', className: 'hidden md:table-cell' },
  { label: 'BAYAR', sortKey: 'paidAt', className: 'hidden md:table-cell' },
  { label: 'KADALUARSA', sortKey: 'expiry' },
  { label: 'JADWAL', className: 'text-right' },
]

function formatIdDate(iso: string | null) {
  if (!iso) return '-'
  // Fixed WIB calendar: same date on any device timezone.
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}`
}

export default function Reminders() {
  // Table state (filter/search/page/limit/sort) persists in URL via the
  // shared contract; selection stays local and clears on view change.
  const {
    filter: stateFilter, setFilter: setStateFilter,
    q, setQ, committedQ,
    page, setPage, limit, setLimit, offset,
    sortKey, sortDir, toggleSort,
  } = useAdminTableParams({
    sortUrlKey: 'sort', defaultSortKey: 'paidAt', defaultSortDir: 'desc',
    filterKey: 'state', filters: ['all', 'none', 'scheduled'] as const, defaultFilter: 'all',
  })
  // Uniform bulk selection: checkbox column always visible, row-body clicks
  // toggle only once armed (first checkbox). Clears on any view change.
  const selection = useRowSelection()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const { toasts, showToast, dismissToast } = useToast()

  const { data, loading, error, fetchedAt, refetch } = useAdminQuery(async (signal) => {
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) }
    if (stateFilter !== 'all') params.state = stateFilter
    if (committedQ) params.q = committedQ
    if (sortKey) { params.sort = sortKey; params.sortDir = sortDir ?? 'desc' }
    const res = await authedApiRequest((c) =>
      c.api.v1.admin.reminders.preview.$get({ query: params }), { signal }
    )
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || `Gagal (${res.status})`)
    }
    return (await res.json()) as { rows: PreviewRow[]; total: number }
  }, [stateFilter, committedQ, offset, limit, sortKey, sortDir], { keepPreviousData: true })
  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  useEffect(() => { selection.clear() }, [stateFilter, committedQ, page, limit, sortKey, sortDir])

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
    const ids = selection.selected
    if (bulkBusy || ids.length === 0) return
    setBulkBusy(true)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.reminders.bulk.$post({ json: { action, ids: ids.slice(0, 20) } })
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
      selection.clear()
      await refetch()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal eksekusi massal', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  const pageIds = rows.map((r) => r.publicId)

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

      <AdminBulkBar
        count={selection.count}
        onClear={selection.clear}
        headerCheckboxId="reminders-select-all"
        actions={
          <>
            <button onClick={() => bulk('schedule')} disabled={bulkBusy} className="ad-btn ad-btn-dark w-full sm:w-auto">
              {bulkBusy ? 'Memproses...' : `Jadwalkan (${selection.count})`}
            </button>
            <button onClick={() => bulk('cancel')} disabled={bulkBusy} className="ad-btn w-full sm:w-auto">
              Batalkan
            </button>
          </>
        }
      />

      <AdminToastStack toasts={toasts} onDone={dismissToast} />

      <div className="ad-card">
        <DataTable
          columns={columns}
          empty={!loading && rows.length === 0}
          emptyText="Belum ada order pada filter ini."
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          selectHeader={
            <SelectAllCheckbox
              id="reminders-select-all"
              label="Pilih semua di halaman ini"
              state={selection.headerState(pageIds)}
              onToggle={() => selection.toggleAll(pageIds)}
            />
          }
        >
          {rows.map((r) => {
            const on = r.reminderState === 'scheduled'
            const rowBusy = busyId === r.publicId
            return (
              <SelectableRow
                key={r.publicId}
                id={r.publicId}
                selection={selection}
                pageIds={pageIds}
                selectLabel={`Pilih ${r.publicId}`}
              >
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
              </SelectableRow>
            )
          })}
        </DataTable>
        <TablePagination
          total={total}
          limit={limit}
          offset={offset}
          onLimitChange={setLimit}
          onOffsetChange={(o) => setPage(Math.floor(o / limit) + 1)}
        />
      </div>
    </div>
  )
}
