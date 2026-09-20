import { useMemo, useState } from 'react'
import DataTable from '../../../components/admin/DataTable'
import CopyCell from '../../../components/admin/CopyCell'
import TableSortMenu from '../../../components/admin/TableSortMenu'
import StatusChip from '../../../components/admin/StatusChip'
import ConfirmDialog, { openConfirm } from '../../../components/admin/ConfirmDialog'
import { SkeletonRows } from '../../../components/admin/TableSkeleton'
import { useTableSort, sortByKey } from '../../../hooks/useTableSort'
import { useRowSelection } from '../../../hooks/useRowSelection'
import { SelectableRow, SelectAllCheckbox } from '../../../components/admin/RowSelection'
import AdminBulkBar from '../../../components/admin/AdminBulkBar'
import { authedApiRequest } from '../../../lib/api'
import { Plus, EditPencil, Trash, Download } from 'iconoir-react'
import BulkImportDialog, { basisBulkConfig } from './BulkImportDialog'
import type { Product, Variant } from '../types'
import { formatIdNumber } from '../../../lib/format'

interface Props {
  products: Product[]
  variants: Variant[]
  onCreate: () => void
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  onImported: () => void
  notify: (msg: string, type: 'success' | 'error') => void
  loading?: boolean
}

// Shared by DataTable headers (desktop) and TableSortMenu (mobile <sm).
const basisColumns = [
  { label: 'INDUK', sortKey: 'name' },
  { label: 'KATEGORI', sortKey: 'category' },
  { label: 'STOK' },
  { label: 'DURASI' },
  { label: 'AVG', sortKey: 'avg' },
  { label: 'MEDIAN', sortKey: 'median' },
  { label: 'MODUS', sortKey: 'mode' },
  { label: 'RENTANG' },
  { label: 'STATUS', sortKey: 'isActive' },
  { label: 'AKSI', className: 'text-right' },
]

export default function BasisPanel({ products, variants, onCreate, onEdit, onDelete, onImported, notify, loading }: Props) {
  const [showImport, setShowImport] = useState(false)
  const priceMap = useMemo(() => {
    const map = new Map<string, { min: number; max: number; avg: number; median: number; mode: number; count: number }>()
    for (const v of variants) {
      if (!v.productId) continue
      const price = Number(v.price)
      const existing = map.get(v.productId)
      if (existing) {
        existing.min = Math.min(existing.min, price)
        existing.max = Math.max(existing.max, price)
        existing.count++
        existing.avg += price
      } else {
        map.set(v.productId, { min: price, max: price, avg: price, median: price, mode: price, count: 1 })
      }
    }
    for (const [, s] of map) {
      s.avg = Math.round(s.avg / s.count)
    }
    // Median + mode per product: one grouping pass (O(N)) instead of a
    // filter per product (O(N*M) — froze admin with many variants).
    const byProduct = new Map<string, number[]>()
    for (const v of variants) {
      if (!v.productId) continue
      const arr = byProduct.get(v.productId)
      if (arr) arr.push(Number(v.price))
      else byProduct.set(v.productId, [Number(v.price)])
    }
    for (const [pid, s] of map) {
      const prices = (byProduct.get(pid) ?? []).sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const midv = prices[mid]!
      s.median = prices.length % 2 ? midv : Math.round(((prices[mid - 1] ?? midv) + midv) / 2)
      const freq = new Map<number, number>()
      for (const p of prices) freq.set(p, (freq.get(p) ?? 0) + 1)
      let maxFreq = 0
      for (const [, f] of freq) { if (f > maxFreq) maxFreq = f }
      s.mode = prices.find((p) => freq.get(p) === maxFreq) ?? prices[0]!
    }
    return map
  }, [variants])

  const variantStats = useMemo(() => {
    const map = new Map<string, { vaultCount: number; stock: number; durations: Set<string> }>()
    for (const v of variants) {
      if (!v.productId) continue
      const existing = map.get(v.productId)
      if (existing) {
        if (v.fulfillmentType !== 'on_demand') {
          existing.vaultCount++
          existing.stock += v.stockCount ?? 0
        }
        if (v.durationMonths) existing.durations.add(`${v.durationMonths} ${v.durationUnit === 'day' ? 'Hari' : v.durationUnit === 'week' ? 'Minggu' : 'Bulan'}`)
      } else {
        const isVault = v.fulfillmentType !== 'on_demand'
        map.set(v.productId, {
          vaultCount: isVault ? 1 : 0,
          stock: isVault ? (v.stockCount ?? 0) : 0,
          durations: new Set(v.durationMonths ? [`${v.durationMonths} ${v.durationUnit === 'day' ? 'Hari' : v.durationUnit === 'week' ? 'Minggu' : 'Bulan'}`] : []),
        })
      }
    }
    return map
  }, [variants])

  // Enriched rows: AVG/MEDIAN/MODUS/STOK/DURASI are computed, so sort
  // must run on enriched rows - raw Product has no avg/median/mode keys.
  const rows = useMemo(() => products.map((p) => {
    const stats = priceMap.get(p.id)
    const vs = variantStats.get(p.id)
    const durArr = vs?.durations ?? new Set<string>()
    return {
      ...p,
      avg: stats?.avg ?? null,
      median: stats?.median ?? null,
      mode: stats?.mode ?? null,
      stockLabel: vs && vs.vaultCount > 0 ? `${vs.stock}/${vs.vaultCount} var` : vs ? '0 var' : '-',
      durLabel: durArr.size === 0 ? '-' : durArr.size === 1 ? [...durArr][0] : `${durArr.size} tipe`,
      rentangLabel: stats && stats.min !== stats.max ? `Rp ${formatIdNumber(stats.min)} - ${formatIdNumber(stats.max)}` : stats ? `Rp ${formatIdNumber(stats.min)}` : '-',
    }
  }), [products, priceMap, variantStats])

  // Sort key persisted in URL (?sort&sort_dir); rows are enriched locally
  // (avg/median/stats), so the actual ordering stays in-memory via sortByKey.
  const { sortKey, sortDir, toggleSort } = useTableSort([], { urlKey: 'sort_basis', defaultKey: 'name', defaultDir: 'asc' })
  const sorted = useMemo(() => sortByKey(rows, sortKey, sortDir), [rows, sortKey, sortDir])

  // Uniform bulk selection: checkbox column always visible, row-body clicks
  // toggle only once armed. No pagination/filter on this tab; selection
  // survives refresh and clears after each bulk action (unmount clears on
  // tab switch).
  const selection = useRowSelection()
  const pageIds = useMemo(() => sorted.map((p) => p.id), [sorted])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [pendingBulk, setPendingBulk] = useState<'activate' | 'deactivate' | null>(null)

  async function runBulkStatus(action: 'activate' | 'deactivate') {
    const ids = selection.selected.slice(0, 20)
    if (bulkBusy || ids.length === 0) return
    setBulkBusy(true)
    setPendingBulk(null)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.products.bulk.status.$post({ json: { action, ids } })
      )
      const out = (await res.json()) as { scanned: number; updated: number; skipped: { id: string; reason: string }[] }
      const verb = action === 'activate' ? 'Diaktifkan' : 'Dinonaktifkan'
      selection.clear()
      onImported()
      notify(
        out.skipped.length === 0
          ? `${verb}: ${out.updated} induk`
          : `${verb} ${out.updated} dari ${out.scanned} - ${out.skipped.length} dilewati (${out.skipped[0]!.reason})`,
        out.updated > 0 ? 'success' : 'error'
      )
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Gagal memproses massal', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  function askBulkStatus(action: 'activate' | 'deactivate') {
    if (action === 'deactivate') {
      setPendingBulk(action)
      openConfirm('basis-bulk-status')
    } else {
      void runBulkStatus(action)
    }
  }

  return (
    <>
    <div className="ad-card-flat p-4 max-sm:px-3 flex flex-wrap items-center gap-4 max-sm:gap-3">
      <div>
        <div className="text-2xl max-sm:text-lg font-semibold leading-none ad-num">{loading ? '-' : products.length}</div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Induk</div>
      </div>
      <div>
        <div className="text-2xl max-sm:text-lg font-semibold leading-none ad-num">{loading ? '-' : new Set(products.map((p) => p.category)).size}</div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Kategori</div>
      </div>
      <div className="ml-auto flex max-w-full items-center gap-2 overflow-x-auto *:shrink-0">
        <TableSortMenu columns={basisColumns} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        {/* Mobile: thead (and its select-all) hides below sm, so the page
            toggle lives here instead. */}
        <button onClick={() => selection.toggleAll(pageIds)} className="ad-btn shrink-0 sm:hidden">
          {selection.headerState(pageIds) === 'all' ? 'Batal pilih' : 'Pilih semua'}
        </button>
        <button onClick={() => setShowImport(true)} className="ad-btn shrink-0 max-sm:px-3"><Download width={15} height={15} strokeWidth={1.5} />Impor</button>
        <button onClick={onCreate} className="ad-btn shrink-0 max-sm:px-3"><Plus width={15} height={15} strokeWidth={1.5} />Induk</button>
      </div>
    </div>
    <BulkImportDialog config={basisBulkConfig} open={showImport} onClose={() => setShowImport(false)} onDone={onImported} notify={notify} />
    <ConfirmDialog
      id="basis-bulk-status"
      title="Nonaktifkan induk terpilih?"
      message={pendingBulk ? `"${selection.count} induk terpilih disembunyikan dari katalog (varian ikut nonaktif)."` : ''}
      confirmLabel="Ya, nonaktifkan"
      onConfirm={() => pendingBulk && void runBulkStatus(pendingBulk)}
    />
    <AdminBulkBar
      count={selection.count}
      onClear={selection.clear}
      headerCheckboxId="basis-select-all"
      actions={
        <>
          <button onClick={() => askBulkStatus('activate')} disabled={bulkBusy} className="ad-btn w-full sm:w-auto">
            {bulkBusy ? 'Memproses...' : `Aktifkan (${selection.count})`}
          </button>
          <button onClick={() => askBulkStatus('deactivate')} disabled={bulkBusy} className="ad-btn ad-btn-danger w-full sm:w-auto">
            {bulkBusy ? 'Memproses...' : `Nonaktifkan (${selection.count})`}
          </button>
        </>
      }
    />
    <div className="ad-card">
      <DataTable
        columns={basisColumns}
        empty={!loading && products.length === 0}
        emptyText="Belum ada induk."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        selectHeader={
          <SelectAllCheckbox
            id="basis-select-all"
            label="Pilih semua induk di halaman ini"
            state={selection.headerState(pageIds)}
            onToggle={() => selection.toggleAll(pageIds)}
          />
        }
      >
        {loading ? <SkeletonRows rows={5} cols={10} /> : sorted.map((p) => {
          return (
          <SelectableRow
            key={p.id}
            id={p.id}
            selection={selection}
            pageIds={pageIds}
            selectLabel={`Pilih induk ${p.name}`}
          >
            <td>
              <div className="text-[13px] font-medium">{p.name}</div>
              <CopyCell value={p.id} display={p.id.slice(0, 8)} className="text-[11px] ad-num text-[#aeaeb2]" />
            </td>
            <td className="text-xs text-[#6e6e73]">{p.category}</td>
            <td className="text-[13px] ad-num font-semibold">{p.stockLabel}</td>
            <td className="text-xs text-[#6e6e73]">{p.durLabel}</td>
            <td className="text-[13px] ad-num font-semibold">{p.avg != null ? `Rp ${formatIdNumber(p.avg)}` : '-'}</td>
            <td className="text-[13px] ad-num text-[#6e6e73]">{p.median != null ? `Rp ${formatIdNumber(p.median)}` : '-'}</td>
            <td className="text-[13px] ad-num text-[#6e6e73]">{p.mode != null ? `Rp ${formatIdNumber(p.mode)}` : '-'}</td>
            <td className="text-xs ad-num text-[#6e6e73]">{p.rentangLabel}</td>
            <td><StatusChip tone={p.isActive ? 'green' : 'zinc'}>{p.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip></td>
            <td className="text-right"><div className="flex justify-end gap-1.5"><button onClick={() => onEdit(p)} className="ad-btn"><EditPencil width={14} height={14} strokeWidth={1.5} />Edit</button><button onClick={() => onDelete(p)} className="ad-btn ad-btn-danger"><Trash width={14} height={14} strokeWidth={1.5} />Hapus</button></div></td>
          </SelectableRow>
          )
        })}
      </DataTable>
    </div>
    </>
  )
}
