import type { FormData } from '../types'

interface Props {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
  editingId: string | null
  categories: string[]
  onSubmit: (e: React.FormEvent) => void
}

export default function IndukDialog({ form, setForm, editingId, categories, onSubmit }: Props) {
  return (
    <dialog id="product_modal" className="modal">
      <div className="modal-box max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-none border border-zinc-900 p-6">
        <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{editingId ? 'Edit Induk' : 'Tambah Induk'}</h3>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-5">
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Nama Induk<input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Kategori<input type="text" required list="category-list" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /><datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Ringkasan (maks 200)<input type="text" value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} maxLength={200} placeholder="Satu baris di bawah nama produk..." className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Deskripsi<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi katalog induk..." rows={3} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Instruksi<textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Panduan setelah pembelian..." rows={3} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-3 border border-zinc-200 bg-zinc-50 px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="checkbox checkbox-sm rounded-none" />
            <span className="text-xs font-bold tracking-widest uppercase text-zinc-500">Aktif di katalog</span>
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => (document.getElementById('product_modal') as HTMLDialogElement)?.close()} className="border border-zinc-200 px-5 py-2 text-sm font-semibold">Batal</button>
            <button type="submit" className="bg-zinc-900 text-white px-6 py-2 text-sm font-semibold">{editingId ? 'Perbarui' : 'Buat'}</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}
