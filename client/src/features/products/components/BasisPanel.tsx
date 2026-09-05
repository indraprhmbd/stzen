import { useMemo } from 'react'
import DataTable from '../../../components/admin/DataTable'
import StatusChip from '../../../components/admin/StatusChip'
import { SkeletonRows } from '../../../components/admin/TableSkeleton'
import { Plus } from 'iconoir-react'
import type { Product, Variant } from '../types'

interface Props {
  products: Product[]
  variants: Variant[]
  onCreate: () => void
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  loading?: boolean
}

export default function BasisPanel({ products, variants, onCreate, onEdit, onDelete, loading }: Props) {
  const priceMap = useMemo(() => {
    const map = new Map<string, { min: number; max: number; avg: number; count: number }>()
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
        map.set(v.productId, { min: price, max: price, avg: price, count: 1 })
      }
    }
    for (const [, v] of map) v.avg = Math.round(v.avg / v.count)
    return map
  }, [variants])

  return (
    <>
    <div className="ad-card-flat p-4 flex flex-wrap items-center gap-6">
      <div>
        <div className="text-2xl font-semibold leading-none ad-num">{loading ? '-' : products.length}</div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Induk</div>
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none ad-num">{loading ? '-' : new Set(products.map((p) => p.category)).size}</div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Kategori</div>
      </div>
      <button onClick={onCreate} className="ad-btn ml-auto"><Plus width={15} height={15} strokeWidth={1.5} />Induk</button>
    </div>
    <div className="ad-card">
      <DataTable
        columns={[{ label: 'INDUK' }, { label: 'KATEGORI' }, { label: 'AVG HARGA' }, { label: 'RENTANG' }, { label: 'STATUS' }, { label: 'AKSI', className: 'text-right' }]}
        empty={!loading && products.length === 0}
        emptyText="Belum ada induk."
      >
        {loading ? <SkeletonRows rows={5} cols={6} /> : products.map((p) => {
          const stats = priceMap.get(p.id)
          return (
          <tr key={p.id}>
            <td className="text-[13px] font-medium">{p.name}</td>
            <td className="text-xs text-[#6e6e73]">{p.category}</td>
            <td className="text-[13px] ad-num font-semibold">{stats ? `Rp ${stats.avg.toLocaleString('id-ID')}` : '-'}</td>
            <td className="text-xs ad-num text-[#6e6e73]">{stats && stats.min !== stats.max ? `Rp ${stats.min.toLocaleString('id-ID')} - ${stats.max.toLocaleString('id-ID')}` : stats ? `Rp ${stats.min.toLocaleString('id-ID')}` : '-'}</td>
            <td><StatusChip tone={p.isActive ? 'green' : 'zinc'}>{p.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip></td>
            <td className="text-right"><div className="flex justify-end gap-1.5"><button onClick={() => onEdit(p)} className="ad-btn">Edit</button><button onClick={() => onDelete(p)} className="ad-btn ad-btn-danger">Hapus</button></div></td>
          </tr>
          )
        })}
      </DataTable>
    </div>
    </>
  )
}
