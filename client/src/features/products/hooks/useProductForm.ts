import { useState } from 'react'
import { authedApiRequest } from '../../../lib/api'
import { emptyForm, type FormData, type Product } from '../types'

// Moved as-is from pages/admin/Products.tsx: induk form state + CRUD.
export function useProductForm(fetchAll: () => void, showToast: (msg: string, type: 'success' | 'error') => void) {
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  function openCreate() {
    setForm(emptyForm); setEditingId(null)
    ;(document.getElementById('product_modal') as HTMLDialogElement)?.showModal()
  }
  function openEdit(p: Product) {
    setForm({ name: p.name, category: p.category, price: String(p.price), badge: p.badge || '', overview: p.overview || '', description: p.description || '', instructions: p.instructions || '', isActive: p.isActive })
    setEditingId(p.id)
    ;(document.getElementById('product_modal') as HTMLDialogElement)?.showModal()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = { name: form.name, category: form.category, badge: form.badge || undefined, overview: form.overview || undefined, description: form.description || undefined, instructions: form.instructions || undefined, isActive: form.isActive }
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

  return { form, setForm, editingId, openCreate, openEdit, handleSubmit }
}
