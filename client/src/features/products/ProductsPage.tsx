import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import ConfirmDialog, { openConfirm } from '../../components/admin/ConfirmDialog'
import { useProducts } from './hooks/useProducts'
import { useProductForm } from './hooks/useProductForm'
import { useVariantForm } from './hooks/useVariantForm'
import { useStockImport } from './hooks/useStockImport'
import VariantGroups from './components/VariantGroups'
import BasisPanel from './components/BasisPanel'
import StockPanel from './components/StockPanel'
import IndukDialog from './components/IndukDialog'
import VariantDialog from './components/VariantDialog'
import type { Variant, Product } from './types'

// Composition only — all logic lives in hooks, all markup in components.
export default function ProductsPage() {
  const { products, variants, loading, error, fetchedAt, toast, fetchAll, showToast, categories } = useProducts()
  const productForm = useProductForm(fetchAll, showToast)
  const variantForm = useVariantForm(products, fetchAll, showToast)
  const stock = useStockImport(variants, fetchAll, showToast)

  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
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

  function askDeleteVariant(v: Variant) {
    setPendingDelete({ kind: 'variant', id: v.id, name: v.name })
    openConfirm('delete-confirm')
  }
  function askDeleteProduct(p: Product) {
    setPendingDelete({ kind: 'product', id: p.id, name: p.name })
    openConfirm('delete-confirm')
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const { kind, id } = pendingDelete
    setPendingDelete(null)
    try {
      const res = kind === 'product'
        ? await authedApiRequest((c) => c.api.v1.admin.products[':id'].$delete({ param: { id } }))
        : await authedApiRequest((c) => c.api.v1.admin.variants[':id'].$delete({ param: { id } }))
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal menghapus')
      }
      showToast(kind === 'product' ? 'Induk dihapus' : 'Varian dihapus', 'success')
      fetchAll()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Gagal menghapus', 'error')
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
        <VariantGroups
          groups={groupedVariants}
          filteredCount={filteredVariants.length}
          collapsedGroups={collapsedGroups}
          setCollapsedGroups={setCollapsedGroups}
          onCreateVariant={variantForm.openCreateVariant}
          onEditVariant={variantForm.openEditVariant}
          onDeleteVariant={askDeleteVariant}
        />
      </div>
      )}

      {tab === 'basis' && (
      <div role="tabpanel" id="panel-basis" aria-labelledby="tab-basis" className="flex flex-col gap-6">
        <BasisPanel
          products={products}
          onCreate={productForm.openCreate}
          onEdit={productForm.openEdit}
          onDelete={askDeleteProduct}
        />
      </div>
      )}

      {tab === 'stok' && (
      <div role="tabpanel" id="panel-stok" aria-labelledby="tab-stok" className="flex flex-col gap-6">
        <StockPanel
          products={products}
          variants={variants}
          collapsedGroups={collapsedGroups}
          setCollapsedGroups={setCollapsedGroups}
          stock={stock}
        />
      </div>
      )}

      <IndukDialog
        form={productForm.form}
        setForm={productForm.setForm}
        editingId={productForm.editingId}
        categories={categories}
        onSubmit={productForm.handleSubmit}
      />
      <VariantDialog
        products={products}
        form={variantForm}
        onSubmit={variantForm.handleVariantSubmit}
      />

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
