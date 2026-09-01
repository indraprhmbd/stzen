import { useState, useEffect, useCallback, useMemo } from 'react'
import { authedApiRequest } from '../../lib/api'

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

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stockProductId, setStockProductId] = useState('')
  const [stockText, setStockText] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const fetchProducts = useCallback(async () => {
    setError(null); setLoading(true)
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.products.$get())
      const data = await res.json() as Product[]
      setProducts(data)
    } catch (e: any) { setError(e?.message || 'Gagal memuat produk'); showToast('Gagal memuat produk', 'error') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [products, q, categoryFilter])

  function openCreate() {
    setForm(emptyForm); setEditingId(null)
    ;(document.getElementById('product_modal') as HTMLDialogElement)?.showModal()
  }
  function openEdit(p: Product) {
    setForm({ name: p.name, category: p.category, price: p.price, badge: p.badge || '', description: p.description || '', instructions: p.instructions || '', isActive: p.isActive })
    setEditingId(p.id)
    ;(document.getElementById('product_modal') as HTMLDialogElement)?.showModal()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = { ...form, description: form.description || undefined, badge: form.badge || undefined, instructions: form.instructions || undefined }
    try {
      if (editingId) {
        await authedApiRequest((c) => c.api.v1.admin.products[':id'].$put({ param: { id: editingId }, json: payload }))
        showToast('Produk diperbarui', 'success')
      } else {
        await authedApiRequest((c) => c.api.v1.admin.products.$post({ json: payload }))
        showToast('Produk dibuat', 'success')
      }
      ;(document.getElementById('product_modal') as HTMLDialogElement)?.close()
      fetchProducts()
    } catch { showToast('Gagal menyimpan', 'error') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus produk ini? Kredensial juga akan terhapus.')) return
    try {
      await authedApiRequest((c) => c.api.v1.admin.products[':id'].$delete({ param: { id } }))
      showToast('Produk dihapus', 'success'); fetchProducts()
    } catch { showToast('Gagal menghapus', 'error') }
  }

  async function handleBulkImport() {
    if (!stockProductId || !stockText.trim()) { showToast('Pilih produk dan isi kredensial', 'error'); return }
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.products[':id'].stock.$post({ param: { id: stockProductId }, json: { credentials: stockText } }))
      const data = await res.json() as { imported: number }
      showToast(`${data.imported} kredensial diimpor`, 'success'); setStockText(''); fetchProducts()
    } catch { showToast('Gagal impor', 'error') }
  }

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  if (error) return <div className="bg-white border border-red-200 p-8 text-center"><div className="text-sm font-bold text-red-600">Gagal memuat</div><div className="text-xs text-zinc-500 mt-1">{error}</div><button onClick={fetchProducts} className="btn btn-sm bg-zinc-900 text-white rounded-sm mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-zinc-200 pb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Produk</h1>
          <p className="text-sm text-zinc-500 mt-1"><span className="font-mono text-zinc-900 font-semibold">{products.length}</span> produk · <span className="font-mono">{categories.length}</span> kategori · <span className="font-mono">{products.reduce((s,p)=>s+p.stockCount,0)}</span> stok</p>
        </div>
        <button onClick={openCreate} className="btn bg-zinc-900 text-white hover:bg-black border-none rounded-sm px-5 font-semibold text-sm">
          + Tambah Produk
        </button>
      </div>

      <div className="bg-white border border-zinc-200 p-3 flex flex-col sm:flex-row gap-3">
        <label className="flex items-center gap-2 flex-1 border border-zinc-200 px-3 py-2 bg-zinc-50">
          <span className="text-[11px] font-bold tracking-widest text-zinc-400">CARI</span>
          <input placeholder="nama produk..." value={q} onChange={(e) => setQ(e.target.value)} className="grow bg-transparent text-sm outline-none placeholder:text-zinc-400" />
        </label>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-zinc-200 bg-white px-3 py-2 text-sm font-mono w-full sm:w-52">
          <option value="ALL">Semua kategori</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-50">
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">NAMA</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">KATEGORI</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">HARGA</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">STOK</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500">STATUS</th>
                <th className="text-[11px] tracking-[0.12em] font-bold text-zinc-500 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-zinc-500">Tidak ada produk: ubah filter atau tambah baru.</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                  <td className="py-3.5">
                    <div className="text-[13px] font-semibold leading-none">{p.name}</div>
                    {p.badge && <span className="inline-block mt-1 text-[10px] font-mono font-bold tracking-wide border border-zinc-900 px-1.5 py-0.5">{p.badge}</span>}
                  </td>
                  <td className="text-xs font-mono text-zinc-600">{p.category}</td>
                  <td className="text-sm font-mono font-semibold">Rp {Number(p.price).toLocaleString('id-ID')}</td>
                  <td><span className={`text-xs font-mono font-semibold px-2 py-1 border ${p.stockCount===0?'bg-zinc-900 text-white border-zinc-900':p.stockCount<5?'bg-white border-amber-300 text-amber-700':'bg-white border-zinc-200 text-zinc-700'}`}>{p.stockCount}</span></td>
                  <td><span className={`text-[11px] font-mono font-semibold px-2 py-1 border ${p.isActive?'bg-white border-zinc-900 text-zinc-900':'bg-zinc-100 border-zinc-200 text-zinc-500'}`}>{p.isActive ? 'AKTIF' : 'NONAKTIF'}</span></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(p)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-zinc-900 hover:text-white transition-colors">Edit</button>
                      <button onClick={() => handleDelete(p.id)} className="text-xs font-semibold border border-zinc-200 px-3 py-1 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-zinc-200">
        <div className="px-5 py-3 border-b border-zinc-200">
          <div className="text-xs font-bold tracking-[0.12em] uppercase">Impor Stok: Vault</div>
          <div className="text-xs text-zinc-500 mt-1 font-mono">Format per baris: email:password | PIN | instruksi</div>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <select value={stockProductId} onChange={(e) => setStockProductId(e.target.value)} className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
            <option value="">Pilih produk</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} - {p.stockCount} stok</option>)}
          </select>
          <textarea value={stockText} onChange={(e) => setStockText(e.target.value)} placeholder="user@email.com:password123" rows={6} className="border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed outline-none focus:border-zinc-900" />
          <div className="flex justify-end">
            <button onClick={handleBulkImport} disabled={!stockProductId || !stockText.trim()} className="bg-zinc-900 text-white text-sm font-semibold px-5 py-2 hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed">Impor ke Vault</button>
          </div>
        </div>
      </div>

      <dialog id="product_modal" className="modal">
        <div className="modal-box max-w-xl bg-white rounded-none border border-zinc-900 p-6">
          <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{editingId ? 'Edit Produk' : 'Tambah Produk'}</h3>
          <p className="text-xs text-zinc-500 mt-1 font-mono">Harga dalam Rupiah, tanpa titik.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-5">
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Nama Produk<input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-900" /></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Kategori<input type="text" required list="category-list" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-900" /><datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Harga (Rp)<input type="text" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="50000" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono outline-none focus:border-zinc-900" /></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Badge<input type="text" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="TERLARIS" className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-900" /></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Deskripsi<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-900" /></label>
            <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">Instruksi<textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-900" /></label>
            <label className="flex items-center gap-3 border border-zinc-200 px-4 py-3 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="checkbox checkbox-sm" /><span className="text-sm font-medium">Aktif: tampil di toko</span></label>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => (document.getElementById('product_modal') as HTMLDialogElement)?.close()} className="border border-zinc-200 px-5 py-2 text-sm font-semibold hover:bg-zinc-50">Batal</button>
              <button type="submit" className="bg-zinc-900 text-white px-6 py-2 text-sm font-semibold hover:bg-black">{editingId ? 'Perbarui' : 'Buat Produk'}</button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      {toast && <div className="toast toast-end"><div className={`border px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-white border-zinc-900 text-zinc-900' : 'bg-red-50 border-red-200 text-red-700'}`}>{toast.msg}</div></div>}
    </div>
  )
}
