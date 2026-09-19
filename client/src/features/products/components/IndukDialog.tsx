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
      <div className="modal-box ad-dialog max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <h3 className="font-semibold text-[17px] tracking-tight">{editingId ? 'Edit Induk' : 'Tambah Induk'}</h3>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-5">
          <label className="ad-label">Nama Induk<input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="ad-input mt-1.5 normal-case" /></label>
          <label className="ad-label">Kategori<input type="text" required list="category-list" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="ad-input mt-1.5 normal-case" /><datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
          <label className="ad-label">Ringkasan (maks 200)<input type="text" value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} maxLength={200} placeholder="Satu baris di bawah nama produk..." className="ad-input mt-1.5 normal-case" /></label>
          <label className="ad-label">Tags (maks 50)<input type="text" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} maxLength={50} placeholder="TERLARIS;PROMO" className="ad-input mt-1.5 normal-case" /><p className="text-[11px] text-[#aeaeb2] mt-1 normal-case font-normal">Pisahkan beberapa tags dengan ; . Kosong = tanpa tags. Varian kosong mengikuti induk.</p></label>
          <label className="ad-label">Deskripsi<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi katalog induk..." rows={3} className="ad-input mt-1.5 normal-case" /></label>
          <label className="ad-label">Instruksi<textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Panduan setelah pembelian..." rows={3} className="ad-input mt-1.5 normal-case" /></label>
          <label className="ad-input flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="checkbox checkbox-sm rounded-full" />
            <span className="ad-label">Aktif di katalog</span>
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => (document.getElementById('product_modal') as HTMLDialogElement)?.close()} className="ad-btn">Batal</button>
            <button type="submit" className="ad-btn ad-btn-dark">{editingId ? 'Perbarui' : 'Buat'}</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}
