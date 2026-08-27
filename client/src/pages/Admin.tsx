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

  // ─── Fetch Products ─────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiV1.admin.products.$get()
      const data = await res.json()
      setProducts(data as Product[])
    } catch (err) {
      showToast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // ─── Toast Helper ───────────────────────────────────────────────────────

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Form Handlers ─────────────────────────────────────────────────────

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
    } catch (err) {
      showToast('Failed to save product', 'error')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? Credentials will also be deleted.')) return
    try {
      await apiV1.admin.products[':id'].$delete({ param: { id } })
      showToast('Product deleted', 'success')
      fetchProducts()
    } catch (err) {
      showToast('Failed to delete product', 'error')
    }
  }

  // ─── Bulk Stock Import ──────────────────────────────────────────────────

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
    } catch (err) {
      showToast('Failed to import credentials', 'error')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Create Product
        </button>
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-base-content/50">
          No products yet. Create your first product to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    {p.name}
                    {p.badge && (
                      <span className="badge badge-sm badge-secondary ml-2">
                        {p.badge}
                      </span>
                    )}
                  </td>
                  <td>{p.category}</td>
                  <td>${p.price}</td>
                  <td>
                    <span
                      className={`badge ${p.stockCount > 0 ? 'badge-success' : 'badge-error'}`}
                    >
                      {p.stockCount}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${p.isActive ? 'badge-success' : 'badge-ghost'}`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="flex gap-1">
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => openEditModal(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-xs btn-error"
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
      <div className="divider my-8"></div>
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title">Bulk Stock Import</h2>
          <p className="text-sm text-base-content/60">
            Paste credentials one per line. Format: email:password or profile:pin:instructions
          </p>
          <select
            className="select select-bordered w-full max-w-xs"
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
            className="textarea textarea-bordered h-40 font-mono text-sm"
            placeholder="user1@email.com:password123&#10;user2@email.com:password456"
            value={stockText}
            onChange={(e) => setStockText(e.target.value)}
          />
          <div className="card-actions justify-end">
            <button
              className="btn btn-primary"
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
        <div className="modal-box">
          <h3 className="font-bold text-lg">
            {editingId ? 'Edit Product' : 'Create Product'}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-4">
            <label className="input">
              <span className="label">Name</span>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="input">
              <span className="label">Category</span>
              <input
                type="text"
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </label>
            <label className="input">
              <span className="label">Price</span>
              <input
                type="text"
                required
                placeholder="9.99"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label className="input">
              <span className="label">Badge (optional)</span>
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
              />
            </label>
            <textarea
              className="textarea textarea-bordered"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <textarea
              className="textarea textarea-bordered"
              placeholder="Usage instructions (optional, shown to buyer after purchase)"
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
              <span className="text-sm">Active (visible in store)</span>
            </label>
            <div className="modal-action">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                className="btn"
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
            className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-error'}`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}
