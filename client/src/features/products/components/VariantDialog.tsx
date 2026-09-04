import type { Product } from '../types'
import type { useVariantForm } from '../hooks/useVariantForm'

interface Props {
  products: Product[]
  form: ReturnType<typeof useVariantForm>
  onSubmit: (e: React.FormEvent) => void
}

export default function VariantDialog({ products, form: v, onSubmit }: Props) {
  return (
    <dialog id="variant_modal" className="modal">
      <div className="modal-box max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-none border border-zinc-900 p-6">
        <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{v.editingVariantId ? 'Edit Varian' : 'Tambah Varian'}</h3>
        {v.editingVariantId && v.editingVariantSku && (
          <div className="mt-2 bg-zinc-50 border border-zinc-200 px-3 py-2 flex items-center gap-3">
            <span className="text-[11px] font-bold tracking-widest text-zinc-400">SKU</span>
            <span className="font-mono text-sm text-zinc-900 font-semibold">{v.editingVariantSku}</span>
          </div>
        )}
        {!v.editingVariantId && (
          <p className="text-xs text-zinc-500 mt-1 font-mono">Nama & SKU di-generate otomatis dari input di bawah.</p>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-5">
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Induk<select value={v.vProductId} onChange={(e) => v.handleVariantBaseChange(e.target.value)} required className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"><option value="">Pilih induk</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Durasi (bulan)<input type="number" value={v.vDuration} onChange={(e) => v.setVDuration(e.target.value)} placeholder="1" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Tipe Akun<input type="text" value={v.vAccountType} onChange={(e) => v.setVAccountType(e.target.value)} placeholder="Private, Shared" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
          </div>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Kondisi<input type="text" value={v.vConditions} onChange={(e) => v.setVConditions(e.target.value)} placeholder="Garansi 30 hari" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Ringkasan (maks 200)<input type="text" value={v.vOverview} onChange={(e) => v.setVOverview(e.target.value)} maxLength={200} placeholder="Kosongkan = ikut induk" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Deskripsi<textarea value={v.vDescription} onChange={(e) => v.setVDescription(e.target.value)} placeholder="Kosongkan = ikut induk" rows={3} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Harga (Rp)<input type="text" required value={v.vPrice} onChange={(e) => v.setVPrice(e.target.value)} placeholder="45000" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono" /></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Badge<input type="text" value={v.vBadge} onChange={(e) => v.setVBadge(e.target.value)} placeholder="TERLARIS;PROMO" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /><p className="text-[11px] text-zinc-400 mt-1 normal-case font-normal">Pisahkan beberapa badge dengan ;</p></label>
          </div>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Harga Coret (opsional)<input type="text" value={v.vCompareAt} onChange={(e) => v.setVCompareAt(e.target.value)} placeholder="60000" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono" /><p className="text-[11px] text-zinc-400 mt-1 normal-case font-normal">Tampil dicoret bila lebih besar dari harga</p></label>
          <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Pemenuhan<select value={v.vFulfillmentType} onChange={(e) => v.setVFulfillmentType(e.target.value === 'on_demand' ? 'on_demand' : 'vault')} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"><option value="vault">Gudang</option><option value="on_demand">On Demand</option></select><p className="text-[11px] text-zinc-400 mt-1">{v.vFulfillmentType === 'on_demand' ? 'Selalu tersedia, tanpa impor stok' : 'Perlu impor kredensial ke vault'}</p></label>
          <label className="flex items-center gap-3 border border-zinc-200 bg-zinc-50 px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={v.vIsActive} onChange={(e) => v.setVIsActive(e.target.checked)} className="checkbox checkbox-sm rounded-none" />
            <span className="text-xs font-bold tracking-widest uppercase text-zinc-500">Aktif di katalog</span>
          </label>
          {v.vProductId && (v.vDuration || v.vAccountType) && (
            <div className="bg-zinc-50 border border-zinc-200 px-3 py-2">
              <span className="text-[11px] font-bold tracking-widest text-zinc-400">PREVIEW</span>
              <div className="text-sm font-semibold text-zinc-900 mt-1">
                {products.find((p) => p.id === v.vProductId)?.name ?? 'Induk'}{v.vDuration ? ` - ${v.vDuration} Bulan` : ''}{v.vAccountType ? ` - ${v.vAccountType}` : ''}{v.vConditions ? ` (${v.vConditions})` : ''}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => (document.getElementById('variant_modal') as HTMLDialogElement)?.close()} className="border border-zinc-200 px-5 py-2 text-sm font-semibold">Batal</button>
            <button type="submit" className="bg-zinc-900 text-white px-6 py-2 text-sm font-semibold">{v.editingVariantId ? 'Perbarui' : 'Buat Varian'}</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}
