import { useState, useEffect, useCallback } from 'react'
import { apiV1 } from '../lib/api'

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
      const res = await apiV1.admin.products.$get()
      const data = await res.json()
      setProducts(data as Product[])
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
        await apiV1.admin.products[':id'].$put(
          { param: { id: editingId }, json: payload },
        )
        showToast('Product updated', 'success')
      } else {
        await apiV1.admin.products.$post({ json: payload })
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
      await apiV1.admin.products[':id'].$delete({ param: { id } })
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
      const res = await apiV1.admin.products[':id'].stock.$post({
        param: { id: stockProductId },
        json: { credentials: stockText },
      })
      const data = await res.json() as { imported: number }
      showToast(`Imported ${data.imported} credentials`, 'success')
      setStockText('')
      fetchProducts()
    } catch {
      showToast('Failed to import credentials', 'error')
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1
          className="text-3xl font-black uppercase tracking-tight text-neutral"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Admin Panel
        </h1>
        <button
          className="btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          onClick={openCreateModal}
        >
          Create Product
        </button>
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-neutral/50 font-bold">
          No products yet. Create your first product to get started.
        </div>
      ) : (
        <div className="overflow-x-auto border-brutal-thick shadow-brutal rounded-md">
          <table className="table">
            <thead className="bg-neutral text-primary">
              <tr>
                <th className="font-black uppercase text-xs">Name</th>
                <th className="font-black uppercase text-xs">Category</th>
                <th className="font-black uppercase text-xs">Price</th>
                <th className="font-black uppercase text-xs">Stock</th>
                <th className="font-black uppercase text-xs">Active</th>
                <th className="font-black uppercase text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-base-300">
                  <td className="font-bold">
                    {p.name}
                    {p.badge && (
                      <span className="badge badge-sm bg-accent text-neutral font-black border-brutal ml-2 -rotate-1 text-xs">
                        {p.badge}
                      </span>
                    )}
                  </td>
                  <td className="font-bold text-xs">{p.category.toUpperCase()}</td>
                  <td className="font-black">${p.price}</td>
                  <td>
                    <span
                      className={`badge border-brutal font-mono font-bold text-xs ${
                        p.stockCount > 0 ? 'bg-success text-neutral' : 'bg-error text-neutral'
                      }`}
                    >
                      {p.stockCount}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge border-brutal font-bold text-xs ${
                        p.isActive ? 'bg-success text-neutral' : 'bg-base-300 text-neutral/50'
                      }`}
                    >
                      {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="flex gap-1">
                    <button
                      className="btn btn-xs btn-primary border-brutal shadow-brutal-sm btn-brutal-interactive font-bold uppercase"
                      onClick={() => openEditModal(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-xs btn-error border-brutal shadow-brutal-sm btn-brutal-interactive font-bold uppercase"
                      onClick={() => handleDelete(p.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Stock Import */}
      <div className="divider my-8 border-neutral/20"></div>
      <div className="card bg-base-200 border-brutal-thick shadow-pop-coral rounded-md">
        <div className="card-body">
          <h2
            className="card-title font-black uppercase text-lg text-neutral"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Bulk Stock Import
          </h2>
          <p
            className="text-xs font-bold text-neutral/60"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Paste credentials one per line. Format: email:password or profile:pin:instructions
          </p>
          <select
            className="select select-bordered w-full max-w-xs border-brutal font-bold text-neutral shadow-brutal-sm rounded-sm"
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
          <textarea
            className="textarea textarea-bordered h-40 font-mono text-xs border-brutal shadow-brutal-sm rounded-sm"
            placeholder="user1@email.com:password123&#10;user2@email.com:password456"
            value={stockText}
            onChange={(e) => setStockText(e.target.value)}
          />
          <div className="card-actions justify-end">
            <button
              className="btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              onClick={handleBulkImport}
              disabled={!stockProductId || !stockText.trim()}
            >
              Import Credentials
            </button>
          </div>
        </div>
      </div>

      {/* Product Create/Edit Modal */}
      <dialog id="product_modal" className="modal">
        <div className="modal-box border-brutal-thick shadow-brutal-lg rounded-md">
          <h3
            className="font-black text-lg uppercase text-neutral"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {editingId ? 'Edit Product' : 'Create Product'}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-4">
            <input
              type="text"
              placeholder="PRODUCT NAME"
              required
              className="input input-bordered w-full bg-base-100 border-brutal font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-neutral shadow-brutal-sm rounded-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="CATEGORY"
              required
              className="input input-bordered w-full bg-base-100 border-brutal font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-neutral shadow-brutal-sm rounded-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <input
              type="text"
              placeholder="PRICE (e.g. 9.99)"
              required
              className="input input-bordered w-full bg-base-100 border-brutal font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-neutral shadow-brutal-sm rounded-sm"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              type="text"
              placeholder="BADGE (optional)"
              className="input input-bordered w-full bg-base-100 border-brutal font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-neutral shadow-brutal-sm rounded-sm"
              value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
            />
            <textarea
              className="textarea textarea-bordered border-brutal font-mono text-xs shadow-brutal-sm rounded-sm"
              placeholder="DESCRIPTION (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <textarea
              className="textarea textarea-bordered border-brutal font-mono text-xs shadow-brutal-sm rounded-sm"
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
                className="btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                className="btn border-brutal shadow-brutal-sm btn-brutal-interactive font-bold uppercase"
                onClick={() =>
                  (document.getElementById('product_modal') as HTMLDialogElement)?.close()
                }
              >
                Cancel
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
            className={`alert border-brutal shadow-brutal-sm font-bold ${
              toast.type === 'success' ? 'alert-success' : 'alert-error'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}
