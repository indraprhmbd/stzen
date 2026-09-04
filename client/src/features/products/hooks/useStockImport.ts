import { useState, useMemo } from 'react'
import { authedApiRequest } from '../../../lib/api'
import type { Variant } from '../types'

// Moved as-is from pages/admin/Products.tsx: vault stock import state + actions.
export function useStockImport(variants: Variant[], fetchAll: () => void, showToast: (msg: string, type: 'success' | 'error') => void) {
  const [stockVariantId, setStockVariantId] = useState('')
  const [stockText, setStockText] = useState('')

  const stockParsed = useMemo(() => {
    const warn: number[] = []
    let total = 0
    stockText.split('\n').forEach((raw, i) => {
      const line = raw.trim()
      if (!line) return
      total += 1
      if (!line.includes(':')) warn.push(i + 1)
    })
    return { total, warn }
  }, [stockText])
  const stockVariant = variants.find((v) => v.id === stockVariantId) ?? null
  const stockVariantOptions = useMemo(
    () =>
      variants
        .filter((v) => v.fulfillmentType !== 'on_demand')
        .map((v) => ({
          value: v.id,
          groupLabel: v.baseName,
          label: v.name,
          sublabel: `${v.sku} · ${v.stockCount} stok`,
        })),
    [variants]
  )
  async function handleStockFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const text = await f.text()
      setStockText((prev) => (prev.trim() ? prev.replace(/\s+$/, '') + '\n' + text.trim() + '\n' : text))
    } catch { showToast('Gagal membaca file', 'error') }
  }

  async function handleBulkImport() {
    if (!stockVariantId || stockParsed.total === 0) { showToast('Pilih varian dan isi kredensial', 'error'); return }
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.variants[':id'].stock.$post({ param: { id: stockVariantId }, json: { credentials: stockText } }))
      const data = await res.json() as { imported?: number; error?: string }
      if (!res.ok || data.imported == null) throw new Error(data.error || 'Gagal impor')
      showToast(`${data.imported} kredensial diimpor`, 'success'); setStockText(''); fetchAll()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal impor', 'error')
    }
  }

  return { stockVariantId, setStockVariantId, stockText, setStockText, stockParsed, stockVariant, stockVariantOptions, handleStockFile, handleBulkImport }
}
