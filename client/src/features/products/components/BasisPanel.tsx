import { useMemo } from 'react'
import SortableDataTable from '../../../components/admin/SortableDataTable'
import StatusChip from '../../../components/admin/StatusChip'
import { SkeletonRows } from '../../../components/admin/TableSkeleton'
import { Plus } from 'iconoir-react'
import type { Product, Variant } from '../types'
import type { ColumnDef } from '@tanstack/react-table'

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
    const map = new Map<string, { min: number; max: number; avg: number; median: number; mode: number }>()
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
    for (const [, s] of map) s.avg = Math.round(s.avg / s.count)
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
    const map = new Map<string, { vaultCount: number; stock: number; durations: Set<string> }>()
    for (const v of variants) {
      if (!v.productId) continue
      const existing = map.get(v.productId)
      if (existing) {
        if (v.fulfillmentType !== 'on_demand') { existing.vaultCount++; existing.stock += v.stockCount ?? 0 }
        if (v.durationMonths) existing.durations.add(`${v.durationMonths} ${v.durationUnit === 'day' ? 'Hari' : v.durationUnit === 'week' ? 'Minggu' : 'Bulan'}`)
      } else {
        const isVault = v.fulfillmentType !== 'on_demand'
        map.set(v.productId, { vaultCount: isVault ? 1 : 0, stock: isVault ? (v.stockCount ?? 0) : 0, durations: new Set(v.durationMonths ? [`${v.durationMonths} ${v.durationUnit === 'day' ? 'Hari' : v.durationUnit === 'week' ? 'Minggu' : 'Bulan'}`] : []) })
      }
    }
    return map
  }, [variants])

  const data = useMemo(() => products.map((p) => {
    const stats = priceMap.get(p.id)
    const vs = variantStats.get(p.id)
    const durArr = vs?.durations ?? new Set()
    return {
      ...p,
      stock: vs && vs.vaultCount > 0 ? `${vs.stock}/${vs.vaultCount} var` : vs ? '0 var' : '-',
      durasi: durArr.size === 0 ? '-' : durArr.size === 1 ? [...durArr][0] : `${durArr.size} tipe`,
      avg: stats?.avg ?? 0,
      median: stats?.median ?? 0,
      mode: stats?.mode ?? 0,
      rentang: stats && stats.min !== stats.max ? `Rp ${stats.min.toLocaleString('id-ID')} - ${stats.max.toLocaleString('id-ID')}` : stats ? `Rp ${stats.min.toLocaleString('id-ID')}` : '-',
    }
  }), [products, priceMap, variantStats])

  const columns: ColumnDef<typeof data[number], any>[] = useMemo(() => [
    { accessorKey: 'name', header: 'INDUK', cell: (ctx) => <span className="text-[13px] font-medium">{ctx.getValue() as string}</span> },
    { accessorKey: 'category', header: 'KATEGORI', cell: (ctx) => <span className="text-xs text-[#6e6e73]">{ctx.getValue() as string}</span> },
    { accessorKey: 'stock', header: 'STOK', enableSorting: false, cell: (ctx) => <span className="text-[13px] ad-num font-semibold">{ctx.getValue() as string}</span> },
    { accessorKey: 'durasi', header: 'DURASI', enableSorting: false, cell: (ctx) => <span className="text-xs text-[#6e6e73]">{ctx.getValue() as string}</span> },
    { accessorKey: 'avg', header: 'AVG', cell: (ctx) => <span className="text-[13px] ad-num font-semibold">Rp {(ctx.getValue() as number).toLocaleString('id-ID')}</span> },
    { accessorKey: 'median', header: 'MEDIAN', cell: (ctx) => <span className="text-[13px] ad-num text-[#6e6e73]">Rp {(ctx.getValue() as number).toLocaleString('id-ID')}</span> },
    { accessorKey: 'mode', header: 'MODUS', cell: (ctx) => <span className="text-[13px] ad-num text-[#6e6e73]">Rp {(ctx.getValue() as number).toLocaleString('id-ID')}</span> },
    { accessorKey: 'rentang', header: 'RENTANG', enableSorting: false, cell: (ctx) => <span className="text-xs ad-num text-[#6e6e73]">{ctx.getValue() as string}</span> },
    { accessorKey: 'isActive', header: 'STATUS', cell: (ctx) => <StatusChip tone={ctx.getValue() ? 'green' : 'zinc'}>{ctx.getValue() ? 'AKTIF' : 'NONAKTIF'}</StatusChip> },
    { id: 'actions', header: 'AKSI', enableSorting: false, meta: { align: 'right' as const }, cell: (ctx) => (
      <div className="flex justify-end gap-1.5">
        <button onClick={() => onEdit(ctx.row.original)} className="ad-btn">Edit</button>
        <button onClick={() => onDelete(ctx.row.original)} className="ad-btn ad-btn-danger">Hapus</button>
      </div>
    )},
  ], [onEdit, onDelete])

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
      {loading ? (
        <div className="overflow-x-auto"><table className="admin-table ad-table table table-sm w-full"><thead><tr>{columns.map((c) => <th key={c.id ?? String(c.accessorKey)}>{typeof c.header === 'string' ? c.header : ''}</th>)}</tr></thead><tbody><SkeletonRows rows={5} cols={columns.length} /></tbody></table></div>
      ) : (
        <SortableDataTable data={data} columns={columns} empty={products.length === 0} emptyText="Belum ada induk." />
      )}
    </div>
    </>
  )
}
