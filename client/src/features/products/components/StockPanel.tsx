import SearchableSelect from '../../../components/admin/SearchableSelect'
import { NavArrowDown } from 'iconoir-react'
import type { Product, Variant } from '../types'
import type { useStockImport } from '../hooks/useStockImport'

interface Props {
  products: Product[]
  variants: Variant[]
  collapsedGroups: Record<string, boolean>
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  stock: ReturnType<typeof useStockImport>
}

export default function StockPanel({ products, variants, collapsedGroups, setCollapsedGroups, stock }: Props) {
  const { stockVariantId, setStockVariantId, stockText, setStockText, stockParsed, stockVariant, stockVariantOptions, handleStockFile, handleBulkImport } = stock
  return (
    <>
    <div className="ad-card-flat p-4">
      <div className="ad-card-title">Ringkas Stok</div>
      <div className="flex flex-wrap items-center gap-6 mt-3">
        <div>
          <div className="text-2xl font-semibold leading-none ad-num">{variants.filter((v) => v.fulfillmentType !== 'on_demand').reduce((s, v) => s + (v.stockCount ?? 0), 0)}</div>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Unit Vault</div>
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none ad-num text-red-600">{variants.filter((v) => v.fulfillmentType !== 'on_demand' && (v.stockCount ?? 0) === 0).length}</div>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Habis</div>
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none ad-num" style={{ color: '#b45309' }}>{variants.filter((v) => v.fulfillmentType !== 'on_demand' && (v.stockCount ?? 0) > 0 && (v.stockCount ?? 0) < 5).length}</div>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Menipis</div>
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none ad-num" style={{ color: '#15803d' }}>{variants.filter((v) => v.fulfillmentType !== 'on_demand' && (v.stockCount ?? 0) >= 5).length}</div>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">Aman</div>
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none ad-num">{variants.filter((v) => v.fulfillmentType === 'on_demand').length}</div>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1">On Demand</div>
        </div>
      </div>
      <div className="mt-4 border-t border-[#f1f1f4] flex flex-col divide-y divide-[#f5f5f7]">
        {variants.length === 0 ? (
          <span className="text-xs text-[#6e6e73] py-3">Belum ada varian.</span>
        ) : (
          products.map((p) => {
            const items = variants.filter((v) => v.productId === p.id)
            if (items.length === 0) return null
            const key = `stok:${p.id}`
            const shut = collapsedGroups[key] ?? true
            const units = items.filter((v) => v.fulfillmentType !== 'on_demand').reduce((s, v) => s + (v.stockCount ?? 0), 0)
            return (
              <div key={p.id}>
                <button onClick={() => setCollapsedGroups((s) => ({ ...s, [key]: !s[key] }))} className="w-full py-2.5 flex items-center gap-2 text-left">
                  <NavArrowDown width={15} height={15} strokeWidth={1.5} className={`shrink-0 text-[#aeaeb2] transition-transform ${shut ? '-rotate-90' : ''}`} />
                  <span className="text-[13px] text-[#1d1d1f]">{p.name}</span>
                  <span className="text-[11px] ad-num text-[#aeaeb2]">{units} unit · {items.length} varian</span>
                </button>
                {!shut && (
                  <div className="pb-2 pl-6 flex flex-col">
                    {items.map((v) => {
                      const short = [v.durationMonths ? `${v.durationMonths} bln` : null, v.accountType, v.conditions].filter(Boolean).join(' · ') || v.sku
                      const n = v.stockCount ?? 0
                      return (
                        <div key={v.id} className="py-1.5 flex items-center justify-between gap-3 border-t border-[#f5f5f7]">
                          <span className="text-xs text-[#6e6e73]">{short}</span>
                          <span className="text-xs ad-num shrink-0" style={v.fulfillmentType === 'on_demand' ? { color: '#aeaeb2' } : n === 0 ? { color: '#dc2626' } : n < 5 ? { color: '#b45309' } : { color: '#15803d' }}>
                            {v.fulfillmentType === 'on_demand' ? 'On demand' : `${n} unit`}
                          </span>
                        </div>
                      )
                    })}
                    <button
                      onClick={() => setCollapsedGroups((s) => ({ ...s, [key]: true }))}
                      className="mt-1.5 pt-1.5 border-t border-[#f1f1f4] text-[11px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f] inline-flex items-center gap-1.5 self-start"
                    >
                      <NavArrowDown width={14} height={14} strokeWidth={1.5} className="rotate-180" />
                      Tutup {p.name}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
    <div className="ad-card">
      <div className="ad-card-head">
        <div>
          <div className="ad-card-title">Impor Stok: Vault per varian</div>
          <div className="text-xs text-[#6e6e73] mt-0.5 ad-num">Stok independen per varian</div>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-4">
        <div>
          <div className="ad-label mb-1.5">1 · Pilih varian</div>
          <SearchableSelect
            value={stockVariantId}
            onChange={setStockVariantId}
            placeholder="Pilih varian"
            emptyText="Varian tidak ditemukan"
            options={stockVariantOptions}
          />
          {stockVariant && (
            <div className="text-[11px] ad-num text-[#6e6e73] mt-1.5">Stok saat ini: <span className="font-semibold text-[#1d1d1f]">{stockVariant.stockCount} unit</span> · {stockVariant.sku}</div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="ad-label">2 · Tempel kredensial</div>
            <div className="flex gap-1.5">
              <label className="ad-btn">Dari file<input type="file" accept=".txt,.csv,.log" className="hidden" onChange={handleStockFile} /></label>
              {stockText && (<button onClick={() => setStockText('')} className="ad-btn ad-btn-danger">Bersihkan</button>)}
            </div>
          </div>
          <textarea value={stockText} onChange={(e) => setStockText(e.target.value)} placeholder="user@email.com:password123" rows={8} className="ad-input font-mono text-xs leading-relaxed" />
          <div className="text-[11px] text-[#aeaeb2] mt-1.5 ad-num">Satu kredensial per baris · format user:pass</div>
          {stockText.trim() !== '' && (
            <div className={`mt-2 rounded-[10px] px-3 py-2 text-xs ${stockParsed.warn.length > 0 ? 'bg-[#fef3e2] text-[#92400e]' : 'bg-[#e7f6ec] text-[#15803d]'}`}>
              <span className="ad-num font-semibold">{stockParsed.total} baris</span> siap impor
              {stockParsed.warn.length > 0 && (<span> · <span className="font-semibold">{stockParsed.warn.length} tanpa ':'</span> (baris {stockParsed.warn.slice(0, 5).join(', ')}{stockParsed.warn.length > 5 ? ',…' : ''}), tetap diimpor apa adanya</span>)}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button onClick={handleBulkImport} disabled={!stockVariantId || stockParsed.total === 0} className="ad-btn ad-btn-dark">Impor{stockParsed.total > 0 ? ` ${stockParsed.total}` : ''} ke Vault</button>
        </div>
      </div>
    </div>
    </>
  )
}
