import { useState, useEffect, useCallback } from 'react'
import { authedApiRequest } from '../lib/api'
import Layout from '../components/Layout'

// ─── Types ──────────────────────────────────────────────────────────────────

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
  createdAt: string
}

interface ProductFormData {
  name: string
  description: string
  category: string
  price: string
  badge: string
  instructions: string
  isActive: boolean
}

const emptyForm: ProductFormData = {
  name: '',
  description: '',
  category: '',
  price: '',
  badge: '',
  instructions: '',
  isActive: true,
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Admin() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockProductId, setStockProductId] = useState<string>('')
  const [stockText, setStockText] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchProducts = useCallback(async () => {
    try {
      const data = await authedApiRequest((c) => c.api.v1.admin.products.$get())
      const result = await data.json()
      setProducts(result as Product[])
    } catch {
      showToast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openCreateModal() {
    setForm(emptyForm)
    setEditingId(null)
    ;(document.getElementById('product_modal') as HTMLDialogElement)?.showModal()
  }

  function openEditModal(product: Product) {
    setForm({
      name: product.name,
      description: product.description || '',
      category: product.category,
      price: product.price,
      badge: product.badge || '',
      instructions: product.instructions || '',
      isActive: product.isActive,
    })
    setEditingId(product.id)
    ;(document.getElementById('product_modal') as HTMLDialogElement)?.showModal()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      description: form.description || undefined,
      badge: form.badge || undefined,
      instructions: form.instructions || undefined,
    }

    try {
      if (editingId) {
        await authedApiRequest((c) =>
          c.api.v1.admin.products[':id'].$put(
            { param: { id: editingId }, json: payload },
          )
        )
        showToast('Product updated', 'success')
      } else {
        await authedApiRequest((c) =>
          c.api.v1.admin.products.$post({ json: payload })
        )
        showToast('Product created', 'success')
      }
      fetchProducts()
    } catch {
      showToast('Failed to save product', 'error')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? Credentials will also be deleted.')) return
    try {
      await authedApiRequest((c) =>
        c.api.v1.admin.products[':id'].$delete({ param: { id } })
      )
      showToast('Product deleted', 'success')
      fetchProducts()
    } catch {
      showToast('Failed to delete product', 'error')
    }
  }

  async function handleBulkImport() {
    if (!stockProductId || !stockText.trim()) {
      showToast('Select a product and enter credentials', 'error')
      return
    }

    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.products[':id'].stock.$post({
          param: { id: stockProductId },
          json: { credentials: stockText },
        })
      )
      const data = await res.json() as { imported: number }
      showToast(`Imported ${data.imported} credentials`, 'success')
      setStockText('')
      fetchProducts()
    } catch {
      showToast('Failed to import credentials', 'error')
    }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <div className="bg-surface-container border-[3px] border-on-surface shadow-3d-subtle p-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-1 h-10 bg-primary-container" />
              <div>
                <h1
                  className="font-black text-2xl md:text-3xl uppercase tracking-tight text-on-surface"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  VAULT MANAGEMENT
                </h1>
                <p
                  className="font-bold text-on-surface-variant mt-1 text-sm"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Administer products and raw credential stock.
                </p>
              </div>
            </div>
            <button
              className="bg-primary-container text-black border-[3px] border-on-surface shadow-brutal btn-brutal-interactive font-black uppercase text-sm px-4 py-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              onClick={openCreateModal}
            >
              CREATE PRODUCT
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Product Form */}
        <div className="md:col-span-5">
          <div className="bg-surface-container border-[3px] border-on-surface shadow-brutal p-4">
            <h2 className="font-bold uppercase text-on-surface border-b-[3px] border-on-surface pb-2 mb-4 text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Product Management
            </h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant/50 font-bold text-sm">
                No products yet. Create your first product.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="bg-surface-container-low border-[2px] border-on-surface p-3 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface truncate">{p.name}</span>
                        {p.badge && (
                          <span className="badge badge-sm bg-secondary text-white font-black border-[2px] border-on-surface -rotate-1 text-[10px]">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-on-surface-variant">${p.price}</span>
                        <span className={`badge badge-sm border-[2px] border-on-surface font-mono font-bold text-[10px] ${p.stockCount > 0 ? 'bg-primary-container text-black' : 'bg-error text-white'}`}>
                          {p.stockCount}
                        </span>
                        <span className={`badge badge-sm border-[2px] border-on-surface font-bold text-[10px] ${p.isActive ? 'bg-primary-container text-black' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                          {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        className="bg-primary-container text-black border-[2px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-bold uppercase text-[10px] px-2 py-1"
                        onClick={() => openEditModal(p)}
                      >
                        EDIT
                      </button>
                      <button
                        className="bg-error text-white border-[2px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-bold uppercase text-[10px] px-2 py-1"
                        onClick={() => handleDelete(p.id)}
                      >
                        DEL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Bulk Import */}
        <div className="md:col-span-7">
          <div className="bg-surface-container border-[3px] border-on-surface shadow-brutal p-4">
            <h2 className="font-bold uppercase text-on-surface border-b-[3px] border-on-surface pb-2 mb-4 text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Bulk Stock Import
            </h2>

            {/* Product selector */}
            <div className="mb-3">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase mb-1 block">
                TARGET PRODUCT
              </label>
              <select
                className="w-full bg-surface-container-low border-[3px] border-on-surface font-bold text-sm text-on-surface shadow-brutal-sm px-3 py-2"
                value={stockProductId}
                onChange={(e) => setStockProductId(e.target.value)}
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Terminal textarea */}
            <div className="bg-on-surface border-[3px] border-secondary-container p-3 min-h-[300px]">
              <label className="font-mono text-xs text-primary-container uppercase mb-2 block">
                RAW CREDENTIAL DATA [FORMAT: USER:PASS]
              </label>
              <textarea
                className="w-full h-[260px] bg-transparent text-primary-container font-mono text-sm border-none focus:ring-0 resize-none placeholder:text-primary-container/30"
                placeholder="user1@email.com:password123&#10;user2@email.com:password456"
                value={stockText}
                onChange={(e) => setStockText(e.target.value)}
              />
            </div>

            {/* Import button */}
            <div className="mt-4 flex justify-end">
              <button
                className="bg-secondary-container text-black border-[3px] border-on-surface px-6 py-3 shadow-3d-pop btn-brutal-interactive font-bold uppercase text-sm"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                onClick={handleBulkImport}
                disabled={!stockProductId || !stockText.trim()}
              >
                PUSH TO VAULT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Create/Edit Modal */}
      <dialog id="product_modal" className="modal">
        <div className="modal-box border-[4px] border-neutral shadow-brutal-lg rounded-sm">
          <h3
            className="font-black text-lg uppercase text-neutral"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {editingId ? 'EDIT PRODUCT' : 'CREATE PRODUCT'}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-4">
            <input
              type="text"
              placeholder="PRODUCT NAME"
              required
              className="w-full bg-base-100 border-[3px] border-neutral font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary px-3 py-2 shadow-brutal-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="CATEGORY"
              required
              className="w-full bg-base-100 border-[3px] border-neutral font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary px-3 py-2 shadow-brutal-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <input
              type="text"
              placeholder="PRICE (e.g. 9.99)"
              required
              className="w-full bg-base-100 border-[3px] border-neutral font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary px-3 py-2 shadow-brutal-sm"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              type="text"
              placeholder="BADGE (optional)"
              className="w-full bg-base-100 border-[3px] border-neutral font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary px-3 py-2 shadow-brutal-sm"
              value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
            />
            <textarea
              className="w-full bg-base-100 border-[3px] border-neutral font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary px-3 py-2 shadow-brutal-sm"
              placeholder="DESCRIPTION (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <textarea
              className="w-full bg-base-100 border-[3px] border-neutral font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary px-3 py-2 shadow-brutal-sm"
              placeholder="USAGE INSTRUCTIONS (optional, shown to buyer after purchase)"
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <span className="text-sm font-bold text-neutral">Active (visible in store)</span>
            </label>
            <div className="modal-action">
              <button
                type="submit"
                className="bg-primary-container border-[3px] border-neutral shadow-brutal btn-brutal-interactive font-black uppercase text-sm text-neutral px-4 py-2"
              >
                {editingId ? 'UPDATE' : 'CREATE'}
              </button>
              <button
                type="button"
                className="bg-base-100 border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-bold uppercase text-sm text-neutral px-4 py-2"
                onClick={() =>
                  (document.getElementById('product_modal') as HTMLDialogElement)?.close()
                }
              >
                CANCEL
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Toast */}
      {toast && (
        <div className="toast toast-end">
          <div
            className={`border-[3px] border-neutral shadow-brutal-sm font-bold text-sm ${
              toast.type === 'success' ? 'bg-success text-neutral' : 'bg-error text-neutral'
            } px-4 py-3`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </Layout>
  )
}
