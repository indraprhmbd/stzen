import { Fragment, useMemo } from 'react'
import DataTable from '../../../components/admin/DataTable'
import TableSortMenu from '../../../components/admin/TableSortMenu'
import CopyCell from '../../../components/admin/CopyCell'
import StatusChip, { type ChipTone } from '../../../components/admin/StatusChip'
import { SkeletonRows } from '../../../components/admin/TableSkeleton'
import { useTableSort, sortByKey } from '../../../hooks/useTableSort'
import { NavArrowDown, Plus, Expand, Collapse, EditPencil, Trash, Key } from 'iconoir-react'
import type { Variant, VariantGroup } from '../types'

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

export default function VariantGroups({ groups, filteredCount, collapsedGroups, setCollapsedGroups, onCreateVariant, onEditVariant, onDeleteVariant, onOpenVault, loading }: Props) {
  // Sort state shared across groups. Variant keys (name/sku/price/stockCount/
  // isActive) sort items within each group; groups keep category order.
  const { sortKey, sortDir, toggleSort } = useTableSort<VariantGroup>(groups, {})
  const itemKey = sortKey === 'priceNum' || sortKey === 'name' || sortKey === 'sku' || sortKey === 'stockCount' || sortKey === 'isActive' ? sortKey : null

  const sortedGroups = useMemo(() => groups.map((g) => {
    if (!itemKey || !sortDir) return g
    const items = g.items.map((v) => ({ ...v, priceNum: Number(v.price) }))
    return { ...g, items: sortByKey(items, itemKey, sortDir) }
  }), [groups, itemKey, sortDir])

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsedGroups[g.key] ?? true)

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
      <tr key={v.id}>
        <td>
          <div className="text-[13px] font-medium">{v.name}</div>
        </td>
        <td><CopyCell value={v.sku} className="text-xs ad-num text-[#6e6e73]" /></td>
        <td className="text-[13px] ad-num font-semibold">Rp {Number(v.price).toLocaleString('id-ID')}{v.compareAtPrice != null && Number(v.compareAtPrice) > Number(v.price) && (<><br /><s className="text-[11px] font-normal text-[#aeaeb2]">Rp {Number(v.compareAtPrice).toLocaleString('id-ID')}</s></>)}</td>
        <td><StatusChip tone={stockTone(v).tone}>{stockTone(v).label}</StatusChip></td>
        <td><StatusChip tone="zinc" className={v.isActive ? '' : 'opacity-60'}>{v.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip></td>
        <td className="text-right">
          <div className="flex justify-end gap-1.5">
            <button onClick={() => onEditVariant(v)} className="ad-btn"><EditPencil width={14} height={14} strokeWidth={1.5} />Edit</button>
            <button onClick={() => onDeleteVariant(v)} className="ad-btn ad-btn-danger"><Trash width={14} height={14} strokeWidth={1.5} />Hapus</button>
            {onOpenVault && <button onClick={() => onOpenVault(v)} title="Lihat stok vault" aria-label="Lihat stok vault" className="ad-btn !px-2.5"><Key width={15} height={15} strokeWidth={1.5} /></button>}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="ad-card">
      {/* flex-wrap: Urutkan + Buka semua + Varian exceed 360px. Without
          wrap the row overflows left and the sort menu opens off-screen. */}
      <div className="ad-card-head flex-wrap" style={{ justifyContent: 'flex-end' }}>
        <TableSortMenu columns={variantColumns} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <button onClick={toggleAll} className="ad-btn" title={allCollapsed ? 'Buka semua' : 'Tutup semua'}>
          {allCollapsed
            ? <Expand width={15} height={15} strokeWidth={1.5} />
            : <Collapse width={15} height={15} strokeWidth={1.5} />}
          {allCollapsed ? 'Buka semua' : 'Tutup semua'}
        </button>
        <button onClick={() => onCreateVariant()} className="ad-btn ad-btn-dark"><Plus width={15} height={15} strokeWidth={1.5} />Varian</button>
      </div>
      <DataTable
        columns={variantColumns}
        empty={!loading && filteredCount === 0}
        emptyText="Belum ada varian."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
      >
        {loading ? <SkeletonRows rows={5} cols={6} /> : sortedGroups.map((g) => {
          const collapsed = collapsedGroups[g.key] ?? true
          return (
          <Fragment key={g.key}>
            <tr onClick={() => setCollapsedGroups((s) => ({ ...s, [g.key]: !collapsed }))} className="cursor-pointer bg-white">
              <td colSpan={5}>
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
                <td colSpan={6} className="text-center">
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
