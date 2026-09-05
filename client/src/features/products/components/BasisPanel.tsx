import DataTable from '../../../components/admin/DataTable'
import { Plus } from 'iconoir-react'
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
    <div className="ad-card-flat p-4 flex flex-wrap items-center gap-6">
      <div>
        <div className="text-2xl font-semibold leading-none ad-num">{products.length}</div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Induk</div>
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none ad-num">{new Set(products.map((p) => p.category)).size}</div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Kategori</div>
      </div>
      <button onClick={onCreate} className="ad-btn ml-auto"><Plus width={15} height={15} strokeWidth={1.5} />Induk</button>
    </div>
    <div className="ad-card">
      <DataTable
        columns={[{ label: 'INDUK' }, { label: 'KATEGORI' }, { label: 'AKSI', className: 'text-right' }]}
        empty={products.length === 0}
        emptyText="Belum ada induk."
      >
        {products.map((p) => (
          <tr key={p.id}>
            <td className="text-[13px] font-medium">{p.name}</td>
            <td className="text-xs ad-num text-[#6e6e73]">{p.category}</td>
            <td className="text-right"><div className="flex justify-end gap-1.5"><button onClick={() => onEdit(p)} className="ad-btn">Edit</button><button onClick={() => onDelete(p)} className="ad-btn ad-btn-danger">Hapus</button></div></td>
          </tr>
        ))}
      </DataTable>
    </div>
    </>
  )
}
