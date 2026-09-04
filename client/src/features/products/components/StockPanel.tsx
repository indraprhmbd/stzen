import SearchableSelect from '../../../components/admin/SearchableSelect'
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
    <div className="bg-white border border-zinc-200 p-4">
      <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Ringkas Stok</div>
      <div className="flex flex-wrap items-center gap-6 mt-3">
        <div>
          <div className="text-2xl font-black font-mono leading-none">{variants.filter((v) => v.fulfillmentType !== 'on_demand').reduce((s, v) => s + (v.stockCount ?? 0), 0)}</div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">Unit Vault</div>
        </div>
        <div>
          <div className="text-2xl font-black font-mono leading-none text-red-600">{variants.filter((v) => v.fulfillmentType !== 'on_demand' && (v.stockCount ?? 0) === 0).length}</div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">Habis</div>
        </div>
        <div>
          <div className="text-2xl font-black font-mono leading-none text-amber-600">{variants.filter((v) => v.fulfillmentType !== 'on_demand' && (v.stockCount ?? 0) > 0 && (v.stockCount ?? 0) < 5).length}</div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">Menipis</div>
        </div>
        <div>
          <div className="text-2xl font-black font-mono leading-none text-emerald-700">{variants.filter((v) => v.fulfillmentType !== 'on_demand' && (v.stockCount ?? 0) >= 5).length}</div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">Aman</div>
        </div>
        <div>
          <div className="text-2xl font-black font-mono leading-none">{variants.filter((v) => v.fulfillmentType === 'on_demand').length}</div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">On Demand</div>
        </div>
      </div>
      <div className="mt-4 border-t border-zinc-200 flex flex-col divide-y divide-zinc-100">
        {variants.length === 0 ? (
          <span className="text-xs text-zinc-500 py-3">Belum ada varian.</span>
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
                  <svg className={`w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform ${shut ? '-rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  <span className="text-[13px] text-zinc-700">{p.name}</span>
                  <span className="text-[11px] font-mono text-zinc-400">{units} unit · {items.length} varian</span>
                </button>
                {!shut && (
                  <div className="pb-2 pl-6 flex flex-col">
                    {items.map((v) => {
                      const short = [v.durationMonths ? `${v.durationMonths} bln` : null, v.accountType, v.conditions].filter(Boolean).join(' · ') || v.sku
                      const n = v.stockCount ?? 0
                      return (
                        <div key={v.id} className="py-1.5 flex items-center justify-between gap-3 border-t border-zinc-50">
                          <span className="text-xs text-zinc-600">{short}</span>
                          <span className={`text-xs font-mono shrink-0 ${v.fulfillmentType === 'on_demand' ? 'text-zinc-400' : n === 0 ? 'text-red-600' : n < 5 ? 'text-amber-600' : 'text-emerald-700'}`}>
                            {v.fulfillmentType === 'on_demand' ? 'On demand' : `${n} unit`}
                          </span>
                        </div>
                      )
                    })}
                    <button
                      onClick={() => setCollapsedGroups((s) => ({ ...s, [key]: true }))}
                      className="mt-1.5 pt-1.5 border-t border-zinc-100 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1.5 self-start"
                    >
                      <svg className="w-3.5 h-3.5 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
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
    <div className="bg-white border border-zinc-200">
      <div className="px-5 py-3 border-b border-zinc-200">
        <div className="text-xs font-bold tracking-[0.12em] uppercase">Impor Stok: Vault per varian</div>
        <div className="text-xs text-zinc-500 mt-1 font-mono">Stok independen per varian</div>
      </div>
      <div className="p-5 flex flex-col gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mb-1.5">1 · Pilih varian</div>
          <SearchableSelect
            value={stockVariantId}
            onChange={setStockVariantId}
            placeholder="Pilih varian"
            emptyText="Varian tidak ditemukan"
            options={stockVariantOptions}
          />
          {stockVariant && (
            <div className="text-[11px] font-mono text-zinc-500 mt-1.5">Stok saat ini: <span className="font-semibold text-zinc-900">{stockVariant.stockCount} unit</span> · {stockVariant.sku}</div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500">2 · Tempel kredensial</div>
            <div className="flex gap-1.5">
              <label className="text-[11px] font-semibold border border-zinc-200 px-2.5 py-1 cursor-pointer hover:bg-zinc-900 hover:text-white">Dari file<input type="file" accept=".txt,.csv,.log" className="hidden" onChange={handleStockFile} /></label>
              {stockText && (<button onClick={() => setStockText('')} className="text-[11px] font-semibold border border-zinc-200 px-2.5 py-1 hover:bg-red-600 hover:text-white">Bersihkan</button>)}
            </div>
          </div>
          <textarea value={stockText} onChange={(e) => setStockText(e.target.value)} placeholder="user@email.com:password123" rows={8} className="w-full border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed outline-none focus:border-zinc-900" />
          <div className="text-[11px] text-zinc-400 mt-1.5 font-mono">Satu kredensial per baris · format user:pass</div>
          {stockText.trim() !== '' && (
            <div className={`mt-2 border px-3 py-2 text-xs ${stockParsed.warn.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <span className="font-mono font-semibold">{stockParsed.total} baris</span> siap impor
              {stockParsed.warn.length > 0 && (<span> · <span className="font-semibold">{stockParsed.warn.length} tanpa ':'</span> (baris {stockParsed.warn.slice(0, 5).join(', ')}{stockParsed.warn.length > 5 ? ',…' : ''}), tetap diimpor apa adanya</span>)}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button onClick={handleBulkImport} disabled={!stockVariantId || stockParsed.total === 0} className="bg-zinc-900 text-white text-sm font-semibold px-5 py-2 hover:bg-black disabled:opacity-30">Impor{stockParsed.total > 0 ? ` ${stockParsed.total}` : ''} ke Vault</button>
        </div>
      </div>
    </div>
    </>
  )
}
