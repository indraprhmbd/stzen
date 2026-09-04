import DataTable from '../../../components/admin/DataTable'
import type { Product } from '../types'

interface Props {
  products: Product[]
  onCreate: () => void
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
}

export default function BasisPanel({ products, onCreate, onEdit, onDelete }: Props) {
  return (
    <>
    <div className="bg-white border border-zinc-200 p-4 flex flex-wrap items-center gap-6">
      <div>
        <div className="text-2xl font-black font-mono leading-none">{products.length}</div>
        <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">Induk</div>
      </div>
      <div>
        <div className="text-2xl font-black font-mono leading-none">{new Set(products.map((p) => p.category)).size}</div>
        <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">Kategori</div>
      </div>
      <button onClick={onCreate} className="ml-auto text-xs font-semibold bg-white border border-zinc-200 px-4 py-1.5 hover:bg-zinc-900 hover:text-white">+ Induk</button>
    </div>
    <div className="bg-white border border-zinc-200 overflow-hidden">
      <DataTable
        columns={[{ label: 'INDUK' }, { label: 'KATEGORI' }, { label: 'AKSI', className: 'text-right' }]}
        empty={products.length === 0}
        emptyText="Belum ada induk."
      >
        {products.map((p) => (
          <tr key={p.id} className="border-b border-zinc-100 last:border-0">
            <td className="text-[13px] font-semibold py-3">{p.name}</td>
            <td className="text-xs font-mono text-zinc-600">{p.category}</td>
            <td className="text-right"><div className="flex justify-end gap-1.5"><button onClick={() => onEdit(p)} className="text-xs border border-zinc-200 px-3 py-1">Edit</button><button onClick={() => onDelete(p)} className="text-xs border border-zinc-200 px-3 py-1 hover:bg-red-600 hover:text-white">Hapus</button></div></td>
          </tr>
        ))}
      </DataTable>
    </div>
    </>
  )
}
