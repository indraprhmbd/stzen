import { Fragment, useEffect, useMemo, useState } from 'react'
import DataTable from '../../../components/admin/DataTable'
import TableSortMenu from '../../../components/admin/TableSortMenu'
import CopyCell from '../../../components/admin/CopyCell'
import StatusChip, { type ChipTone } from '../../../components/admin/StatusChip'
import ConfirmDialog, { openConfirm } from '../../../components/admin/ConfirmDialog'
import { SkeletonRows } from '../../../components/admin/TableSkeleton'
import { useTableSort, sortByKey } from '../../../hooks/useTableSort'
import { useRowSelection } from '../../../hooks/useRowSelection'
import { SelectableRow, SelectAllCheckbox } from '../../../components/admin/RowSelection'
import AdminBulkBar from '../../../components/admin/AdminBulkBar'
import { authedApiRequest } from '../../../lib/api'
import { NavArrowDown, Plus, Expand, Collapse, EditPencil, Trash, Key, Download } from 'iconoir-react'
import BulkImportDialog, { varianBulkConfig } from './BulkImportDialog'
import type { Variant, VariantGroup } from '../types'
import { formatIdNumber } from '../../../lib/format'

function stockTone(v: { fulfillmentType: string; stockCount: number }): { tone: ChipTone; label: string } {
  if (v.fulfillmentType === 'on_demand') return { tone: 'emerald', label: 'Tersedia' }
  if (v.stockCount === 0) return { tone: 'dark', label: '0' }
  if (v.stockCount < 5) return { tone: 'amber', label: String(v.stockCount) }
  return { tone: 'zinc', label: String(v.stockCount) }
}

interface Props {
  groups: VariantGroup[]
  filteredCount: number
  collapsedGroups: Record<string, boolean>
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onCreateVariant: (productId?: string) => void
  onEditVariant: (v: Variant) => void
  onDeleteVariant: (v: Variant) => void
  onOpenVault?: (v: Variant) => void
  onImported: () => void
  notify: (msg: string, type: 'success' | 'error') => void
  loading?: boolean
}

// Shared by DataTable headers (desktop) and TableSortMenu (mobile <sm).
const variantColumns = [
  { label: 'VARIAN', sortKey: 'name' },
  { label: 'SKU', sortKey: 'sku' },
  { label: 'HARGA', sortKey: 'priceNum' },
  { label: 'STOK', sortKey: 'stockCount' },
  { label: 'STATUS', sortKey: 'isActive' },
  { label: 'AKSI', className: 'text-right' },
]

export default function VariantGroups({ groups, filteredCount, collapsedGroups, setCollapsedGroups, onCreateVariant, onEditVariant, onDeleteVariant, onOpenVault, onImported, notify, loading }: Props) {
  const [showImport, setShowImport] = useState(false)
  // Sort state shared across groups and persisted in URL (?sort&sort_dir).
  // Variant keys sort items within each group in memory (groups keep
  // category order); the URL only carries the key so refresh/links keep it.
  const { sortKey, sortDir, toggleSort } = useTableSort<VariantGroup>([], { urlKey: 'sort' })
  const itemKey = sortKey === 'priceNum' || sortKey === 'name' || sortKey === 'sku' || sortKey === 'stockCount' || sortKey === 'isActive' ? sortKey : null

  const sortedGroups = useMemo(() => groups.map((g) => {
    if (!itemKey || !sortDir) return g
    const items = g.items.map((v) => ({ ...v, priceNum: Number(v.price) }))
    return { ...g, items: sortByKey(items, itemKey, sortDir) }
  }), [groups, itemKey, sortDir])

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsedGroups[g.key] ?? true)

  // Uniform bulk selection. pageIds cover expanded visible rows only
  // (collapsed items are unrendered; the anchor fallback covers drift).
  // Clears whenever the filtered set changes (search/filter/refresh).
  const selection = useRowSelection()
  const pageIds = useMemo(() => {
    const ids: string[] = []
    for (const g of sortedGroups) {
      if (collapsedGroups[g.key] ?? true) continue
      for (const v of g.items) ids.push(v.id)
    }
    return ids
  }, [sortedGroups, collapsedGroups])
  useEffect(() => { selection.clear() }, [groups])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [pendingBulk, setPendingBulk] = useState<'activate' | 'deactivate' | null>(null)

  async function runBulkStatus(action: 'activate' | 'deactivate') {
    const ids = selection.selected.slice(0, 20)
    if (bulkBusy || ids.length === 0) return
    setBulkBusy(true)
    setPendingBulk(null)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.variants.bulk.status.$post({ json: { action, ids } })
      )
      const out = (await res.json()) as { scanned: number; updated: number; skipped: { id: string; reason: string }[] }
      const verb = action === 'activate' ? 'Diaktifkan' : 'Dinonaktifkan'
      selection.clear()
      onImported()
      notify(
        out.skipped.length === 0
          ? `${verb}: ${out.updated} varian`
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
      openConfirm('varian-bulk-status')
    } else {
      void runBulkStatus(action)
    }
  }

  function toggleAll() {
    const next = !allCollapsed
    setCollapsedGroups((s) => {
      const copy = { ...s }
      for (const g of groups) copy[g.key] = next
      return copy
    })
  }

  function renderVariantRow(v: Variant) {
    return (
      <SelectableRow
        key={v.id}
        id={v.id}
        selection={selection}
        pageIds={pageIds}
        selectLabel={`Pilih varian ${v.name}`}
      >
        <td>
          <div className="text-[13px] font-medium">{v.name}</div>
        </td>
        <td><CopyCell value={v.sku} className="text-xs ad-num text-[#6e6e73]" /></td>
        <td className="text-[13px] ad-num font-semibold">Rp {formatIdNumber(v.price)}{v.compareAtPrice != null && Number(v.compareAtPrice) > Number(v.price) && (<><br /><s className="text-[11px] font-normal text-[#aeaeb2]">Rp {formatIdNumber(v.compareAtPrice)}</s></>)}</td>
        <td><StatusChip tone={stockTone(v).tone}>{stockTone(v).label}</StatusChip></td>
        <td><StatusChip tone="zinc" className={v.isActive ? '' : 'opacity-60'}>{v.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip></td>
        <td className="text-right">
          <div className="flex justify-end gap-1.5">
            <button onClick={() => onEditVariant(v)} className="ad-btn"><EditPencil width={14} height={14} strokeWidth={1.5} />Edit</button>
            <button onClick={() => onDeleteVariant(v)} className="ad-btn ad-btn-danger"><Trash width={14} height={14} strokeWidth={1.5} />Hapus</button>
            {onOpenVault && <button onClick={() => onOpenVault(v)} title="Lihat stok vault" aria-label="Lihat stok vault" className="ad-btn !px-2.5"><Key width={15} height={15} strokeWidth={1.5} /></button>}
          </div>
        </td>
      </SelectableRow>
    )
  }

  return (
    <div className="ad-card">
      {/* flex-wrap: Urutkan + Buka semua + Varian exceed 360px. Without
          wrap the row overflows left and the sort menu opens off-screen. */}
      <div className="ad-card-head flex-wrap" style={{ justifyContent: 'flex-end' }}>
        <TableSortMenu columns={variantColumns} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        {/* Mobile: thead (and its select-all) hides below sm. */}
        <button onClick={() => selection.toggleAll(pageIds)} className="ad-btn sm:hidden">
          {selection.headerState(pageIds) === 'all' ? 'Batal pilih' : 'Pilih semua'}
        </button>
        <span className="hidden sm:inline">
        <button onClick={toggleAll} className="ad-btn" title={allCollapsed ? 'Buka semua' : 'Tutup semua'}>
          {allCollapsed
            ? <Expand width={15} height={15} strokeWidth={1.5} />
            : <Collapse width={15} height={15} strokeWidth={1.5} />}
          {allCollapsed ? 'Buka semua' : 'Tutup semua'}
        </button>
        </span>
        <button onClick={() => setShowImport(true)} className="ad-btn"><Download width={15} height={15} strokeWidth={1.5} />Impor</button>
        <button onClick={() => onCreateVariant()} className="ad-btn ad-btn-dark"><Plus width={15} height={15} strokeWidth={1.5} />Varian</button>
      </div>
      <BulkImportDialog config={varianBulkConfig} open={showImport} onClose={() => setShowImport(false)} onDone={onImported} notify={notify} />
      <ConfirmDialog
        id="varian-bulk-status"
        title="Nonaktifkan varian terpilih?"
        message={pendingBulk ? `"${selection.count} varian terpilih disembunyikan dari katalog."` : ''}
        confirmLabel="Ya, nonaktifkan"
        onConfirm={() => pendingBulk && void runBulkStatus(pendingBulk)}
      />
      <AdminBulkBar
        count={selection.count}
        onClear={selection.clear}
        headerCheckboxId="varian-select-all"
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
      <DataTable
        columns={variantColumns}
        empty={!loading && filteredCount === 0}
        emptyText="Belum ada varian."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        selectHeader={
          <SelectAllCheckbox
            id="varian-select-all"
            label="Pilih semua varian terlihat di halaman ini"
            state={selection.headerState(pageIds)}
            onToggle={() => selection.toggleAll(pageIds)}
          />
        }
      >
        {loading ? <SkeletonRows rows={5} cols={6} /> : sortedGroups.map((g) => {
          const collapsed = collapsedGroups[g.key] ?? true
          return (
          <Fragment key={g.key}>
            <tr onClick={() => setCollapsedGroups((s) => ({ ...s, [g.key]: !collapsed }))} className="cursor-pointer bg-white">
              <td colSpan={6}>
                <span className="inline-flex items-center gap-2">
                  <NavArrowDown width={15} height={15} strokeWidth={1.5} className={`text-[#6e6e73] transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                  <span className="text-[13px] text-[#1d1d1f]">{g.label} ({g.items.length})</span>
                </span>
              </td>
              <td className="text-right">
                <button onClick={(e) => { e.stopPropagation(); onCreateVariant(g.productId ?? undefined) }} className="ad-btn"><Plus width={14} height={14} strokeWidth={1.5} />Varian</button>
              </td>
            </tr>
            {!collapsed && g.items.map((v) => renderVariantRow(v))}
            {!collapsed && (
              <tr className="bg-white">
                <td colSpan={7} className="text-center">
                  <button
                    onClick={() => setCollapsedGroups((s) => ({ ...s, [g.key]: true }))}
                    className="text-[11px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f] inline-flex items-center gap-1.5"
                  >
                    <NavArrowDown width={14} height={14} strokeWidth={1.5} className="rotate-180" />
                    Tutup {g.label}
                  </button>
                </td>
              </tr>
            )}
          </Fragment>
          )
        })}
      </DataTable>
    </div>
  )
}
