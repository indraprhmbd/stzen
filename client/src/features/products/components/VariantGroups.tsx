import { Fragment } from 'react'
import DataTable from '../../../components/admin/DataTable'
import StatusChip, { type ChipTone } from '../../../components/admin/StatusChip'
import { NavArrowDown, Plus } from 'iconoir-react'
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
}

export default function VariantGroups({ groups, filteredCount, collapsedGroups, setCollapsedGroups, onCreateVariant, onEditVariant, onDeleteVariant }: Props) {
  function renderVariantRow(v: Variant) {
    return (
      <tr key={v.id}>
        <td>
          <div className="text-[13px] font-medium">{v.name}</div>
        </td>
        <td className="text-xs ad-num text-[#6e6e73]">{v.sku}</td>
        <td className="text-[13px] ad-num font-semibold">Rp {Number(v.price).toLocaleString('id-ID')}{v.compareAtPrice != null && Number(v.compareAtPrice) > Number(v.price) && (<><br /><s className="text-[11px] font-normal text-[#aeaeb2]">Rp {Number(v.compareAtPrice).toLocaleString('id-ID')}</s></>)}</td>
        <td><StatusChip tone={stockTone(v).tone}>{stockTone(v).label}</StatusChip></td>
        <td><StatusChip tone="zinc" className={v.isActive ? '' : 'opacity-60'}>{v.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip></td>
        <td className="text-right">
          <div className="flex justify-end gap-1.5">
            <button onClick={() => onEditVariant(v)} className="ad-btn">Edit</button>
            <button onClick={() => onDeleteVariant(v)} className="ad-btn ad-btn-danger">Hapus</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="ad-card">
      <div className="ad-card-head">
        <div>
          <div className="ad-card-title">Varian per Induk</div>
          <div className="text-[11px] text-[#6e6e73] mt-0.5">Klik baris induk untuk membuka atau menutup daftar variannya</div>
        </div>
        <button onClick={() => onCreateVariant()} className="ad-btn ad-btn-dark"><Plus width={15} height={15} strokeWidth={1.5} />Varian</button>
      </div>
      <DataTable
        columns={[
          { label: 'VARIAN' },
          { label: 'SKU' },
          { label: 'HARGA' },
          { label: 'STOK' },
          { label: 'STATUS' },
          { label: 'AKSI', className: 'text-right' },
        ]}
        empty={filteredCount === 0}
        emptyText="Belum ada varian."
      >
        {groups.map((g) => {
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
