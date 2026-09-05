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
    // Median + mode per product
    for (const [pid, s] of map) {
      const prices = variants.filter((v) => v.productId === pid).map((v) => Number(v.price)).sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      s.median = prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2)
      const freq = new Map<number, number>()
      for (const p of prices) freq.set(p, (freq.get(p) ?? 0) + 1)
      let maxFreq = 0
      for (const [, f] of freq) { if (f > maxFreq) maxFreq = f }
      s.mode = prices.find((p) => freq.get(p) === maxFreq) ?? prices[0]
    }
    return map
  }, [variants])

  const variantStats = useMemo(() => {
    const map = new Map<string, { total: number; stock: number; types: Set<string>; durations: Set<string> }>()
    for (const v of variants) {
      if (!v.productId) continue
      const existing = map.get(v.productId)
      if (existing) {
        existing.total++
        existing.stock += v.fulfillmentType !== 'on_demand' ? (v.stockCount ?? 0) : 0
        existing.types.add(v.fulfillmentType)
        if (v.durationMonths) existing.durations.add(`${v.durationMonths} ${v.durationUnit === 'day' ? 'Hari' : v.durationUnit === 'week' ? 'Minggu' : 'Bulan'}`)
      } else {
        map.set(v.productId, {
          total: 1,
          stock: v.fulfillmentType !== 'on_demand' ? (v.stockCount ?? 0) : 0,
          types: new Set([v.fulfillmentType]),
          durations: new Set(v.durationMonths ? [`${v.durationMonths} ${v.durationUnit === 'day' ? 'Hari' : v.durationUnit === 'week' ? 'Minggu' : 'Bulan'}`] : []),
        })
      }
    }
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
        columns={[{ label: 'INDUK' }, { label: 'KATEGORI' }, { label: 'VARIAN' }, { label: 'STOK' }, { label: 'TIPE' }, { label: 'DURASI' }, { label: 'AVG' }, { label: 'MEDIAN' }, { label: 'MODUS' }, { label: 'RENTANG' }, { label: 'STATUS' }, { label: 'AKSI', className: 'text-right' }]}
        empty={!loading && products.length === 0}
        emptyText="Belum ada induk."
      >
        {loading ? <SkeletonRows rows={5} cols={12} /> : products.map((p) => {
          const stats = priceMap.get(p.id)
          const vs = variantStats.get(p.id)
          const types = vs?.types ?? new Set()
          const typeLabel = types.size > 1 ? 'Mixed' : types.has('on_demand') ? 'On Demand' : 'Vault'
          const durArr = vs?.durations ?? new Set()
          const durLabel = durArr.size === 0 ? '-' : durArr.size === 1 ? [...durArr][0] : `${durArr.size} tipe`
          return (
          <tr key={p.id}>
            <td className="text-[13px] font-medium">{p.name}</td>
            <td className="text-xs text-[#6e6e73]">{p.category}</td>
            <td className="text-[13px] ad-num">{vs?.total ?? 0}</td>
            <td className="text-[13px] ad-num font-semibold">{vs?.stock ?? 0}</td>
            <td className="text-xs text-[#6e6e73]">{typeLabel}</td>
            <td className="text-xs text-[#6e6e73]">{durLabel}</td>
            <td className="text-[13px] ad-num font-semibold">{stats ? `Rp ${stats.avg.toLocaleString('id-ID')}` : '-'}</td>
            <td className="text-[13px] ad-num text-[#6e6e73]">{stats ? `Rp ${stats.median.toLocaleString('id-ID')}` : '-'}</td>
            <td className="text-[13px] ad-num text-[#6e6e73]">{stats ? `Rp ${stats.mode.toLocaleString('id-ID')}` : '-'}</td>
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
