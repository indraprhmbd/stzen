import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import ConfirmDialog, { openConfirm } from '../../components/admin/ConfirmDialog'
import { Refresh, Search } from 'iconoir-react'
import { useProducts } from './hooks/useProducts'
import { useProductForm } from './hooks/useProductForm'
import { useVariantForm } from './hooks/useVariantForm'
import VariantGroups from './components/VariantGroups'
import BasisPanel from './components/BasisPanel'
import VaultList from './components/VaultList'
import IndukDialog from './components/IndukDialog'
import VariantDialog from './components/VariantDialog'
import type { Variant, Product } from './types'

// Composition only — all logic lives in hooks, all markup in components.
export default function ProductsPage() {
  const { products, variants, loading, error, fetchedAt, toast, fetchAll, showToast, categories } = useProducts()
  const productForm = useProductForm(fetchAll, showToast)
  const variantForm = useVariantForm(products, fetchAll, showToast)

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
  if (error) return <div className="ad-card-flat p-8 text-center"><div className="text-sm font-semibold text-red-600">Gagal memuat</div><div className="text-xs text-[#6e6e73] mt-1">{error}</div><button onClick={fetchAll} className="ad-btn ad-btn-dark mt-4">Coba lagi</button></div>

  const vaultUnits = variants.filter((v) => v.fulfillmentType !== 'on_demand').reduce((s, v) => s + (v.stockCount ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Produk</h1>
          <p className="text-[13px] text-[#6e6e73] mt-0.5 ad-num"><span className="text-[#1d1d1f] font-semibold">{products.length}</span> induk · {variants.length} varian · {vaultUnits} stok{fetchedAt && <span className="text-[#aeaeb2]"> · Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Produk" className="ad-seg">
            {tabs.map(([key, label]) => (
              <button key={key} role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls={`panel-${key}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={fetchAll} title="Muat ulang" className="ad-btn">
            <Refresh width={15} height={15} strokeWidth={1.5} />
            Muat ulang
          </button>
        </div>
      </div>

      <div className="ad-card-flat p-3 flex flex-col sm:flex-row gap-3">
        <label className="ad-input flex items-center gap-2 flex-1">
          <Search width={15} height={15} strokeWidth={1.5} className="shrink-0 text-[#aeaeb2]" />
          <input placeholder="nama varian, sku..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none" />
        </label>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="ad-input w-full sm:w-52">
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
        <VaultList variants={variants} fetchedAt={fetchedAt} />
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

      {toast && <div className="toast toast-end mb-14 lg:mb-0"><div className={`rounded-[12px] px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-[#1d1d1f] text-white' : 'bg-[#fdecec] text-[#b91c1c]'}`} style={toast.type === 'success' ? undefined : { border: '1px solid #f5c2c2' }}>{toast.msg}</div></div>}
    </div>
  )
}
