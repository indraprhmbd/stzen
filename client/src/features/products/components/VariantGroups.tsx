import { Fragment } from 'react'
import DataTable from '../../../components/admin/DataTable'
import StatusChip, { type ChipTone } from '../../../components/admin/StatusChip'
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
      <tr key={v.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
        <td className="py-3">
          <div className="text-[13px] font-semibold">{v.name}</div>
        </td>
        <td className="text-xs font-mono">{v.sku}</td>
        <td className="text-sm font-mono font-semibold">Rp {Number(v.price).toLocaleString('id-ID')}{v.compareAtPrice != null && Number(v.compareAtPrice) > Number(v.price) && (<><br /><s className="text-[11px] font-normal text-zinc-400">Rp {Number(v.compareAtPrice).toLocaleString('id-ID')}</s></>)}</td>
        <td><StatusChip tone={stockTone(v).tone}>{stockTone(v).label}</StatusChip></td>
        <td><StatusChip tone={v.isActive ? 'zinc' : 'zinc'} className={v.isActive ? 'border-zinc-900 text-zinc-900' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}>{v.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip></td>
        <td className="text-right">
          <div className="flex justify-end gap-1.5">
            <button onClick={() => onEditVariant(v)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-zinc-900 hover:text-white">Edit</button>
            <button onClick={() => onDeleteVariant(v)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-red-600 hover:text-white">Hapus</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="bg-white border border-zinc-200 overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Varian per Induk</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Klik baris induk untuk membuka atau menutup daftar variannya</div>
        </div>
        <button onClick={() => onCreateVariant()} className="text-xs font-semibold bg-zinc-900 text-white px-4 py-1.5 hover:bg-black">+ Varian</button>
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
            <tr onClick={() => setCollapsedGroups((s) => ({ ...s, [g.key]: !collapsed }))} className="bg-zinc-50 border-b border-zinc-200 cursor-pointer hover:bg-zinc-100">
              <td colSpan={5} className="py-2">
                <span className="inline-flex items-center gap-2">
                  <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  <span className="text-[13px] text-zinc-700">{g.label} ({g.items.length})</span>
                </span>
              </td>
              <td className="text-right py-2">
                <button onClick={(e) => { e.stopPropagation(); onCreateVariant(g.productId ?? undefined) }} className="text-xs font-semibold border border-zinc-200 bg-white px-3 py-1 hover:bg-zinc-900 hover:text-white">+ Varian</button>
              </td>
            </tr>
            {!collapsed && g.items.map((v) => renderVariantRow(v))}
            {!collapsed && (
              <tr className="bg-zinc-50/60 border-b border-zinc-200">
                <td colSpan={6} className="py-2 text-center">
                  <button
                    onClick={() => setCollapsedGroups((s) => ({ ...s, [g.key]: true }))}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
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
