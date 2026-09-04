import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import DataTable from '../../components/admin/DataTable'
import StatusChip, { type ChipTone } from '../../components/admin/StatusChip'
import ConfirmDialog, { openConfirm } from '../../components/admin/ConfirmDialog'
import SearchableSelect from '../../components/admin/SearchableSelect'

interface Product {
  id: string
  name: string
  description: string | null
  category: string
  price: string
  badge: string | null
  instructions: string | null
  isActive: boolean
  stockCount: number
}

interface Variant {
  id: string
  sku: string
  name: string
  price: string | number
  compareAtPrice?: number | null
  badge: string | null
  durationMonths: number | null
  accountType: string | null
  conditions: string | null
  fulfillmentType: string
  isActive: boolean
  stockCount: number
  productId: string | null
  baseName?: string
  category?: string
}

interface FormData {
  name: string
  category: string
  price: string
  badge: string
  description: string
  instructions: string
  isActive: boolean
}

const emptyForm: FormData = { name: '', category: '', price: '', badge: '', description: '', instructions: '', isActive: true }

function stockTone(v: { fulfillmentType: string; stockCount: number }): { tone: ChipTone; label: string } {
  if (v.fulfillmentType === 'on_demand') return { tone: 'emerald', label: 'Tersedia' }
  if (v.stockCount === 0) return { tone: 'dark', label: '0' }
  if (v.stockCount < 5) return { tone: 'amber', label: String(v.stockCount) }
  return { tone: 'zinc', label: String(v.stockCount) }
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockVariantId, setStockVariantId] = useState('')
  const [stockText, setStockText] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab = tabParam === 'basis' || tabParam === 'stok' ? tabParam : 'varian'
  function setTab(t: string) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (t === 'varian') p.delete('tab')
      else p.set('tab', t)
      return p
    })
  }
  const tabs = [['basis', 'Produk'], ['varian', 'Varian'], ['stok', 'Stok']] as const
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'product' | 'variant'; id: string; name: string } | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  // variant form
  const [vProductId, setVProductId] = useState('')
  const [vPrice, setVPrice] = useState('')
  const [vCompareAt, setVCompareAt] = useState('')
  const [vDuration, setVDuration] = useState<string>('')
  const [vAccountType, setVAccountType] = useState('')
  const [vConditions, setVConditions] = useState('')
  const [vBadge, setVBadge] = useState('')
  const [vFulfillmentType, setVFulfillmentType] = useState<'vault' | 'on_demand'>('vault')
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [editingVariantSku, setEditingVariantSku] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setError(null); setLoading(true)
    try {
      const [resP, resV] = await Promise.all([
        authedApiRequest((c) => c.api.v1.admin.products.$get()),
        authedApiRequest((c) => c.api.v1.admin.variants.$get()),
      ])
      const dataP = await resP.json() as Product[]
      const dataV = await resV.json() as Variant[]
      setProducts(dataP)
      setVariants(dataV)
      setFetchedAt(Date.now())
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Gagal memuat'; setError(msg); showToast(msg, 'error') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products])

  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (categoryFilter !== 'ALL') {
        const baseCat = products.find((p) => p.id === v.productId || p.name === v.baseName)?.category
        if (baseCat !== categoryFilter && v.category !== categoryFilter) return false
      }
      if (q && !v.name.toLowerCase().includes(q.toLowerCase()) && !v.sku.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [variants, products, q, categoryFilter])

  const groupedVariants = useMemo(() => {
    const order = new Map(products.map((p, i) => [p.id, i]))
    const map = new Map<string, { key: string; productId: string | null; label: string; items: Variant[] }>()
    for (const v of filteredVariants) {
      const key = v.productId ?? `base:${v.baseName ?? '?'}`
      let g = map.get(key)
      if (!g) {
        const parent = v.productId ? products.find((p) => p.id === v.productId) : undefined
        g = { key, productId: v.productId, label: parent?.name ?? v.baseName ?? 'Tanpa induk', items: [] }
        map.set(key, g)
      }
      g.items.push(v)
    }
    return [...map.values()].sort((a, b) => (order.get(a.productId ?? '') ?? 999) - (order.get(b.productId ?? '') ?? 999))
  }, [filteredVariants, products])

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

  function openCreate() {
    setForm(emptyForm); setEditingId(null)
    ;(document.getElementById('product_modal') as HTMLDialogElement)?.showModal()
  }
  function openEdit(p: Product) {
    setForm({ name: p.name, category: p.category, price: String(p.price), badge: p.badge || '', description: p.description || '', instructions: p.instructions || '', isActive: p.isActive })
    setEditingId(p.id)
    ;(document.getElementById('product_modal') as HTMLDialogElement)?.showModal()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = { name: form.name, category: form.category, badge: form.badge || undefined, description: form.description || undefined, instructions: form.instructions || undefined, isActive: form.isActive }
    // induk price optional, do not send empty
    if (form.price && form.price.trim() !== '') payload.price = form.price.trim()
    try {
      if (editingId) {
        await authedApiRequest((c) => c.api.v1.admin.products[':id'].$put({ param: { id: editingId }, json: payload }))
        showToast('Produk diperbarui', 'success')
      } else {
        await authedApiRequest((c) => c.api.v1.admin.products.$post({ json: payload }))
        showToast('Produk dibuat', 'success')
      }
      ;(document.getElementById('product_modal') as HTMLDialogElement)?.close()
      fetchAll()
    } catch { showToast('Gagal menyimpan', 'error') }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const { kind, id } = pendingDelete
    setPendingDelete(null)
    try {
      if (kind === 'product') {
        await authedApiRequest((c) => c.api.v1.admin.products[':id'].$delete({ param: { id } }))
        showToast('Produk dihapus', 'success')
      } else {
        await authedApiRequest((c) => c.api.v1.admin.variants[':id'].$delete({ param: { id } }))
        showToast('Varian dihapus', 'success')
      }
      fetchAll()
    } catch { showToast('Gagal menghapus', 'error') }
  }

  function openCreateVariant(presetProductId?: string) {
    setEditingVariantId(null); setEditingVariantSku(null); setVProductId(presetProductId ?? products[0]?.id ?? ''); setVPrice(''); setVCompareAt(''); setVDuration(''); setVAccountType(''); setVConditions(''); setVBadge(''); setVFulfillmentType('vault')
    ;(document.getElementById('variant_modal') as HTMLDialogElement)?.showModal()
  }
  function openEditVariant(v: Variant) {
    setEditingVariantId(v.id); setEditingVariantSku(v.sku); setVProductId(v.productId ?? ''); setVPrice(String(v.price)); setVCompareAt(v.compareAtPrice ? String(v.compareAtPrice) : ''); setVDuration(v.durationMonths ? String(v.durationMonths) : ''); setVAccountType(v.accountType ?? ''); setVConditions(v.conditions ?? ''); setVBadge(v.badge ?? ''); setVFulfillmentType(v.fulfillmentType === 'on_demand' ? 'on_demand' : 'vault')
    ;(document.getElementById('variant_modal') as HTMLDialogElement)?.showModal()
  }
  async function handleVariantSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = {
      productId: vProductId,
      price: vPrice,
      compareAtPrice: vCompareAt.trim() === '' ? null : vCompareAt.trim(),
      badge: vBadge || null,
      durationMonths: vDuration ? parseInt(vDuration, 10) : null,
      accountType: vAccountType || null,
      conditions: vConditions || null,
      fulfillmentType: vFulfillmentType,
    }
    try {
      if (editingVariantId) {
        await authedApiRequest((c) => c.api.v1.admin.variants[':id'].$put({ param: { id: editingVariantId }, json: payload }))
        showToast('Varian diperbarui', 'success')
      } else {
        await authedApiRequest((c) => c.api.v1.admin.variants.$post({ json: payload }))
        showToast('Varian dibuat', 'success')
      }
      ;(document.getElementById('variant_modal') as HTMLDialogElement)?.close()
      fetchAll()
    } catch { showToast('Gagal menyimpan varian', 'error') }
  }
  function renderVariantRow(v: Variant) {
    return (
      <tr key={v.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
        <td className="py-3">
          <div className="text-[13px] font-semibold">{v.name}</div>
        </td>
        <td className="text-xs font-mono">{v.sku}</td>
        <td className="text-sm font-mono font-semibold">Rp {Number(v.price).toLocaleString('id-ID')}{v.compareAtPrice != null && Number(v.compareAtPrice) > Number(v.price) && (<><br /><s className="text-[11px] font-normal text-zinc-400">Rp {Number(v.compareAtPrice).toLocaleString('id-ID')}</s></>)}</td>
        <td><StatusChip tone={stockTone(v).tone}>{stockTone(v).label}</StatusChip></td>
        <td><StatusChip tone={v.isActive ? 'zinc' : 'zinc'} className={v.isActive ? 'border-zinc-900 text-zinc-900' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}>{v.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip></td>
        <td className="text-right">
          <div className="flex justify-end gap-1.5">
            <button onClick={() => openEditVariant(v)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-zinc-900 hover:text-white">Edit</button>
            <button onClick={() => askDeleteVariant(v)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-red-600 hover:text-white">Hapus</button>
          </div>
        </td>
      </tr>
    )
  }
  function askDeleteVariant(v: Variant) {
    setPendingDelete({ kind: 'variant', id: v.id, name: v.name })
    openConfirm('delete-confirm')
  }
  function askDeleteProduct(p: Product) {
    setPendingDelete({ kind: 'product', id: p.id, name: p.name })
    openConfirm('delete-confirm')
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

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  if (error) return <div className="bg-white border border-red-200 p-8 text-center"><div className="text-sm font-bold text-red-600">Gagal memuat</div><div className="text-xs text-zinc-500 mt-1">{error}</div><button onClick={fetchAll} className="btn btn-sm bg-zinc-900 text-white rounded-sm mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-zinc-200 pb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Produk</h1>
          <p className="text-sm text-zinc-500 mt-1"><span className="font-mono text-zinc-900 font-semibold">{products.length}</span> induk · <span className="font-mono">{variants.length}</span> varian · <span className="font-mono">{variants.filter((v) => v.fulfillmentType !== 'on_demand').reduce((s,v)=>s+(v.stockCount??0),0)}</span> stok{fetchedAt && <span className="font-mono text-zinc-400"> · Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}</p>
        </div>
        <div role="tablist" aria-label="Produk" className="flex gap-1 overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button key={key} role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls={`panel-${key}`} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-bold tracking-wide uppercase whitespace-nowrap ${tab === key ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900 bg-white border border-zinc-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 p-3 flex flex-col sm:flex-row gap-3">
        <label className="flex items-center gap-2 flex-1 border border-zinc-200 px-3 py-2 bg-zinc-50">
          <span className="text-[11px] font-bold tracking-widest text-zinc-400">CARI</span>
          <input placeholder="nama varian, sku..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none placeholder:text-zinc-400" />
        </label>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-zinc-200 bg-white px-3 py-2 text-sm font-mono w-full sm:w-52">
          <option value="ALL">Semua kategori</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {tab === 'varian' && (
      <div role="tabpanel" id="panel-varian" aria-labelledby="tab-varian" className="flex flex-col gap-6">
      {/* Variants behave like products */}
      <div className="bg-white border border-zinc-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase">Varian per Induk</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Klik baris induk untuk membuka atau menutup daftar variannya</div>
          </div>
          <button onClick={() => openCreateVariant()} className="text-xs font-semibold bg-zinc-900 text-white px-4 py-1.5 hover:bg-black">+ Varian</button>
        </div>
        <DataTable
          columns={[
            { label: 'VARIAN' },
            { label: 'SKU' },
            { label: 'HARGA' },
            { label: 'STOK' },
            { label: 'STATUS' },
            { label: 'AKSI', className: 'text-right' },
          ]}
          empty={filteredVariants.length === 0}
          emptyText="Belum ada varian."
        >
          {groupedVariants.map((g) => {
            const collapsed = collapsedGroups[g.key] ?? true
            return (
            <Fragment key={g.key}>
              <tr onClick={() => setCollapsedGroups((s) => ({ ...s, [g.key]: !collapsed }))} className="bg-zinc-50 border-b border-zinc-200 cursor-pointer hover:bg-zinc-100">
                <td colSpan={5} className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    <span className="text-[13px] text-zinc-700">{g.label} ({g.items.length})</span>
                  </span>
                </td>
                <td className="text-right py-2">
                  <button onClick={(e) => { e.stopPropagation(); openCreateVariant(g.productId ?? undefined) }} className="text-xs font-semibold border border-zinc-200 bg-white px-3 py-1 hover:bg-zinc-900 hover:text-white">+ Varian</button>
                </td>
              </tr>
              {!collapsed && g.items.map((v) => renderVariantRow(v))}
              {!collapsed && (
                <tr className="bg-zinc-50/60 border-b border-zinc-200">
                  <td colSpan={6} className="py-2 text-center">
                    <button
                      onClick={() => setCollapsedGroups((s) => ({ ...s, [g.key]: true }))}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                      Tutup {g.label}
                    </button>
                  </td>
                </tr>
              )}
            </Fragment>
            )
          })}
        </DataTable>
      </div>
      </div>
      )}

      {tab === 'basis' && (
      <div role="tabpanel" id="panel-basis" aria-labelledby="tab-basis" className="flex flex-col gap-6">
      <div className="bg-white border border-zinc-200 p-4 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-2xl font-black font-mono leading-none">{products.length}</div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">Induk</div>
        </div>
        <div>
          <div className="text-2xl font-black font-mono leading-none">{new Set(products.map((p) => p.category)).size}</div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">Kategori</div>
        </div>
        <button onClick={openCreate} className="ml-auto text-xs font-semibold bg-white border border-zinc-200 px-4 py-1.5 hover:bg-zinc-900 hover:text-white">+ Induk</button>
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
              <td className="text-right"><div className="flex justify-end gap-1.5"><button onClick={() => openEdit(p)} className="text-xs border border-zinc-200 px-3 py-1">Edit</button><button onClick={() => askDeleteProduct(p)} className="text-xs border border-zinc-200 px-3 py-1 hover:bg-red-600 hover:text-white">Hapus</button></div></td>
            </tr>
          ))}
        </DataTable>
      </div>
      </div>
      )}

      {tab === 'stok' && (
      <div role="tabpanel" id="panel-stok" aria-labelledby="tab-stok" className="flex flex-col gap-6">
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
      </div>
      )}

      <dialog id="product_modal" className="modal">
        <div className="modal-box max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-none border border-zinc-900 p-6">
          <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{editingId ? 'Edit Induk' : 'Tambah Induk'}</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-5">
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Nama Induk<input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Kategori<input type="text" required list="category-list" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /><datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => (document.getElementById('product_modal') as HTMLDialogElement)?.close()} className="border border-zinc-200 px-5 py-2 text-sm font-semibold">Batal</button>
              <button type="submit" className="bg-zinc-900 text-white px-6 py-2 text-sm font-semibold">{editingId ? 'Perbarui' : 'Buat'}</button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      <dialog id="variant_modal" className="modal">
        <div className="modal-box max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-none border border-zinc-900 p-6">
          <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{editingVariantId ? 'Edit Varian' : 'Tambah Varian'}</h3>
          {editingVariantId && editingVariantSku && (
            <div className="mt-2 bg-zinc-50 border border-zinc-200 px-3 py-2 flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-widest text-zinc-400">SKU</span>
              <span className="font-mono text-sm text-zinc-900 font-semibold">{editingVariantSku}</span>
            </div>
          )}
          {!editingVariantId && (
            <p className="text-xs text-zinc-500 mt-1 font-mono">Nama & SKU di-generate otomatis dari input di bawah.</p>
          )}
          <form onSubmit={handleVariantSubmit} className="flex flex-col gap-4 mt-5">
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Induk<select value={vProductId} onChange={(e) => setVProductId(e.target.value)} required className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"><option value="">Pilih induk</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Durasi (bulan)<input type="number" value={vDuration} onChange={(e) => setVDuration(e.target.value)} placeholder="1" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Tipe Akun<input type="text" value={vAccountType} onChange={(e) => setVAccountType(e.target.value)} placeholder="Private, Shared" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
            </div>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Kondisi<input type="text" value={vConditions} onChange={(e) => setVConditions(e.target.value)} placeholder="Garansi 30 hari" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Harga (Rp)<input type="text" required value={vPrice} onChange={(e) => setVPrice(e.target.value)} placeholder="45000" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono" /></label>
              <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Badge<input type="text" value={vBadge} onChange={(e) => setVBadge(e.target.value)} placeholder="TERLARIS;PROMO" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" /><p className="text-[11px] text-zinc-400 mt-1 normal-case font-normal">Pisahkan beberapa badge dengan ;</p></label>
            </div>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Harga Coret (opsional)<input type="text" value={vCompareAt} onChange={(e) => setVCompareAt(e.target.value)} placeholder="60000" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono" /><p className="text-[11px] text-zinc-400 mt-1 normal-case font-normal">Tampil dicoret bila lebih besar dari harga</p></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Pemenuhan<select value={vFulfillmentType} onChange={(e) => setVFulfillmentType(e.target.value === 'on_demand' ? 'on_demand' : 'vault')} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"><option value="vault">Gudang</option><option value="on_demand">On Demand</option></select><p className="text-[11px] text-zinc-400 mt-1">{vFulfillmentType === 'on_demand' ? 'Selalu tersedia, tanpa impor stok' : 'Perlu impor kredensial ke vault'}</p></label>
            {vProductId && (vDuration || vAccountType) && (
              <div className="bg-zinc-50 border border-zinc-200 px-3 py-2">
                <span className="text-[11px] font-bold tracking-widest text-zinc-400">PREVIEW</span>
                <div className="text-sm font-semibold text-zinc-900 mt-1">
                  {products.find((p) => p.id === vProductId)?.name ?? 'Induk'}{vDuration ? ` - ${vDuration} Bulan` : ''}{vAccountType ? ` - ${vAccountType}` : ''}{vConditions ? ` (${vConditions})` : ''}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => (document.getElementById('variant_modal') as HTMLDialogElement)?.close()} className="border border-zinc-200 px-5 py-2 text-sm font-semibold">Batal</button>
              <button type="submit" className="bg-zinc-900 text-white px-6 py-2 text-sm font-semibold">{editingVariantId ? 'Perbarui' : 'Buat Varian'}</button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      <ConfirmDialog
        id="delete-confirm"
        title={pendingDelete?.kind === 'product' ? 'Hapus induk?' : 'Hapus varian?'}
        message={pendingDelete ? `"${pendingDelete.name}" akan dihapus permanen.` : ''}
        confirmLabel="Ya, hapus"
        onConfirm={confirmDelete}
      />

      {toast && <div className="toast toast-end mb-14 lg:mb-0"><div className={`border px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-white border-zinc-900 text-zinc-900' : 'bg-red-50 border-red-200 text-red-700'}`}>{toast.msg}</div></div>}
    </div>
  )
}
