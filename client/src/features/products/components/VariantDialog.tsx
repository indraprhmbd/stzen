import { useState } from 'react'
import type { Product } from '../types'
import type { useVariantForm } from '../hooks/useVariantForm'
import { Xmark } from 'iconoir-react'
import RupiahInput from '../../../components/admin/RupiahInput'

const unitLabel: Record<string, string> = { day: 'Hari', week: 'Minggu', month: 'Bulan' }

interface Props {
  products: Product[]
  form: ReturnType<typeof useVariantForm>
  onSubmit: (e: React.FormEvent) => void
  onImportNow?: (variantId: string) => void
}

export default function VariantDialog({ products, form: v, onSubmit, onImportNow }: Props) {
  const [createdVariantId, setCreatedVariantId] = useState<string | null>(null)
  const base = products.find((p) => p.id === v.vProductId)
  const baseOverview = base?.overview ?? ''
  const baseDescription = base?.description ?? ''
  function mode(text: string, blank: boolean, baseText: string): 'blank' | 'inherit' | 'custom' {
    if (blank) return 'blank'
    const t = text.trim()
    return t === '' || t === baseText.trim() ? 'inherit' : 'custom'
  }
  const overviewMode = mode(v.vOverview, v.vOverviewBlank, baseOverview)
  const descriptionMode = mode(v.vDescription, v.vDescriptionBlank, baseDescription)
  const modeCaption = { blank: 'Kosong, disembunyikan di katalog', inherit: 'Ikut induk', custom: 'Kustom, menimpa induk' } as const
  const clearBtn = 'inline-flex items-center gap-1 text-[11px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f]'
  function handleClose() {
    setCreatedVariantId(null)
    ;(document.getElementById('variant_modal') as HTMLDialogElement)?.close()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!v.editingVariantId && onImportNow) {
      // Create: intercept to show import prompt
      v.handleVariantSubmit(e, (id) => setCreatedVariantId(id))
    } else {
      // Edit: normal flow
      v.handleVariantSubmit(e)
    }
  }

  return (
    <dialog id="variant_modal" className="modal">
      <div className="modal-box ad-dialog max-w-xl max-h-[90vh] overflow-y-auto p-6">
        {createdVariantId ? (
          /* Post-create import prompt */
          <div className="text-center py-4">
            <div className="text-[15px] font-semibold text-[#1d1d1f]">Varian dibuat</div>
            <p className="text-[13px] text-[#6e6e73] mt-1">Impor kredensial sekarang?</p>
            <div className="flex justify-center gap-2 mt-5">
              <button onClick={() => { onImportNow!(createdVariantId); handleClose() }} className="ad-btn ad-btn-dark">Impor</button>
              <button onClick={handleClose} className="ad-btn">Skip</button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-[17px] tracking-tight">{v.editingVariantId ? 'Edit Varian' : 'Tambah Varian'}</h3>
        {v.editingVariantId && v.editingVariantSku && (
          <div className="mt-2 bg-[#f5f5f7] rounded-[10px] px-3 py-2 flex items-center gap-3">
            <span className="ad-label">SKU</span>
            <span className="ad-num text-sm text-[#1d1d1f] font-semibold">{v.editingVariantSku}</span>
          </div>
        )}
        {!v.editingVariantId && (
          <p className="text-xs text-[#6e6e73] mt-1 ad-num">Nama dan SKU di-generate otomatis dari input di bawah.</p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-5">
          <label className="ad-label">Induk<select value={v.vProductId} onChange={(e) => v.handleVariantBaseChange(e.target.value)} required className="ad-input mt-1.5 normal-case"><option value="">Pilih induk</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="ad-label">Durasi<input type="number" value={v.vDuration} onChange={(e) => v.setVDuration(e.target.value)} placeholder="7" className="ad-input mt-1.5 normal-case" /></label>
            <label className="ad-label col-span-2">Unit<select value={v.vDurationUnit} onChange={(e) => v.setVDurationUnit(e.target.value as 'day' | 'week' | 'month')} className="ad-input mt-1.5 normal-case"><option value="day">Hari</option><option value="week">Minggu</option><option value="month">Bulan</option></select></label>
          </div>
          <label className="ad-label">Tipe Akun<input type="text" value={v.vAccountType} onChange={(e) => v.setVAccountType(e.target.value)} placeholder="Private, Shared" className="ad-input mt-1.5 normal-case" /></label>
          <label className="ad-label">Kondisi<input type="text" value={v.vConditions} onChange={(e) => v.setVConditions(e.target.value)} placeholder="Garansi 30 hari" className="ad-input mt-1.5 normal-case" /></label>
          <div>
            <label className="ad-label">Ringkasan (maks 200)<input type="text" value={v.vOverview} onChange={(e) => { v.setVOverviewBlank(false); v.setVOverview(e.target.value) }} maxLength={200} placeholder={baseOverview || 'Tulis ringkasan...'} className="ad-input mt-1.5 normal-case" /></label>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-[#aeaeb2]">{modeCaption[overviewMode]}</span>
              {overviewMode === 'blank'
                ? <button type="button" onClick={() => { v.setVOverviewBlank(false); v.setVOverview(baseOverview) }} className={clearBtn}>Ikuti induk</button>
                : <button type="button" onClick={() => { v.setVOverview(''); v.setVOverviewBlank(true) }} className={clearBtn}><Xmark width={12} height={12} strokeWidth={2} />Kosongkan</button>}
            </div>
          </div>
          <div>
            <label className="ad-label">Deskripsi<textarea value={v.vDescription} onChange={(e) => { v.setVDescriptionBlank(false); v.setVDescription(e.target.value) }} placeholder={baseDescription || 'Tulis deskripsi...'} rows={3} className="ad-input mt-1.5 normal-case" /></label>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-[#aeaeb2]">{modeCaption[descriptionMode]}</span>
              {descriptionMode === 'blank'
                ? <button type="button" onClick={() => { v.setVDescriptionBlank(false); v.setVDescription(baseDescription) }} className={clearBtn}>Ikuti induk</button>
                : <button type="button" onClick={() => { v.setVDescription(''); v.setVDescriptionBlank(true) }} className={clearBtn}><Xmark width={12} height={12} strokeWidth={2} />Kosongkan</button>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RupiahInput label="Harga (Rp)" required value={v.vPrice} onChange={v.setVPrice} placeholder="45000" hint={v.vPrice !== '' && Number(v.vPrice) < 10_000 ? 'Di bawah Rp10.000: QRIS otomatis nonaktif, hanya pesanan manual' : undefined} />
            <label className="ad-label">Badge<input type="text" value={v.vBadge} onChange={(e) => v.setVBadge(e.target.value)} placeholder="TERLARIS;PROMO" className="ad-input mt-1.5 normal-case" /><p className="text-[11px] text-[#aeaeb2] mt-1 normal-case font-normal">Pisahkan beberapa badge dengan ;</p></label>
          </div>
          <RupiahInput label="Harga Coret (opsional)" value={v.vCompareAt} onChange={v.setVCompareAt} placeholder="60000" hint="Tampil dicoret bila lebih besar dari harga" />
          <label className="ad-label">Pemenuhan<select value={v.vFulfillmentType} onChange={(e) => v.setVFulfillmentType(e.target.value === 'on_demand' ? 'on_demand' : 'vault')} className="ad-input mt-1.5 normal-case"><option value="vault">Gudang</option><option value="on_demand">On Demand</option></select><p className="text-[11px] text-[#aeaeb2] mt-1">{v.vFulfillmentType === 'on_demand' ? 'Selalu tersedia, tanpa impor stok' : 'Perlu impor kredensial ke vault'}</p></label>
          <label className="ad-input flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={v.vRequiresDeliveryInfo} onChange={(e) => v.setVRequiresDeliveryInfo(e.target.checked)} className="checkbox checkbox-sm rounded-full" />
            <span className="ad-label">Minta akun + WA saat checkout</span>
          </label>
          <label className="ad-input flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={v.vIsActive} onChange={(e) => v.setVIsActive(e.target.checked)} className="checkbox checkbox-sm rounded-full" />
            <span className="ad-label">Aktif di katalog</span>
          </label>
          {v.vProductId && (v.vDuration || v.vAccountType) && (
            <div className="bg-[#f5f5f7] rounded-[10px] px-3 py-2">
              <span className="ad-label">PREVIEW</span>
              <div className="text-sm font-medium text-[#1d1d1f] mt-1">
                {products.find((p) => p.id === v.vProductId)?.name ?? 'Induk'}{v.vDuration ? ` - ${v.vDuration} ${unitLabel[v.vDurationUnit]}` : ''}{v.vAccountType ? ` - ${v.vAccountType}` : ''}{v.vConditions ? ` (${v.vConditions})` : ''}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={handleClose} className="ad-btn">Batal</button>
            <button type="submit" className="ad-btn ad-btn-dark">{v.editingVariantId ? 'Perbarui' : 'Buat Varian'}</button>
          </div>
        </form>
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}
