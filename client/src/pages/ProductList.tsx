import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiV1 } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'
import Layout from '../components/Layout'
import FilterBar from '../components/FilterBar'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import SkeletonCard from '../components/SkeletonCard'
import CopyToast from '../components/CopyToast'

type Product = {
  id: string
  name: string
  description: string | null
  category: string
  price: string
  badge: string | null
  isActive: boolean
  stockCount: number
  fulfillmentType?: string
}

type PaginatedResult = {
  products: Product[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export default function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const brand = useBrand()
  const { t } = useCopy()
  const { session } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  // Read all state from URL
  const category = searchParams.get('category') || 'all'
  const sort = searchParams.get('sort') || 'newest'
  const page = parseInt(searchParams.get('page') || '1')
  const search = searchParams.get('search') || ''
  const view = isMobile ? 'grid' : ((searchParams.get('view') as 'grid' | 'list') || 'list')

  const [result, setResult] = useState<PaginatedResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')
  const [catData, setCatData] = useState<{ categories: string[]; counts: Record<string, number> }>({ categories: ['all'], counts: {} })

  // Fetch full category list once (independent of active filter)
  useEffect(() => {
    apiV1.products.categories.$get().then(async (res) => {
      if (res.ok) {
        const data = await res.json() as { categories: string[]; counts: Record<string, number> }
        setCatData({ categories: ['all', ...data.categories], counts: data.counts })
      }
    }).catch(() => {})
  }, [])

  // Fetch products on every URL param change
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const query: Record<string, string> = {}
    if (category !== 'all') query.category = category
    if (sort !== 'newest') query.sort = sort
    if (page > 1) query.page = String(page)
    if (search) query.search = search

    apiV1.products.$get({ query }).then(async (res) => {
      if (cancelled) return
      if (res.ok) {
        const data = await res.json()
        // Check if paginated (has .products array) or legacy flat array
        if (Array.isArray(data)) {
          setResult({ products: data as Product[], total: (data as Product[]).length, page: 1, limit: 24, totalPages: 1 })
        } else {
          setResult(data as PaginatedResult)
        }
      }
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [category, sort, page, search])

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Helper: update URL params, reset to page 1 on filter change
  function updateParam(key: string, value: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (!value || value === 'all' || (key === 'sort' && value === 'newest') || (key === 'search' && !value)) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      // Reset page on filter change (except when changing page itself)
      if (key !== 'page') params.delete('page')
      return params
    })
  }

  const categories = catData.categories
  const allTotal = Object.values(catData.counts).reduce((a, b) => a + b, 0)
  const categoryCounts: Record<string, number> = { all: allTotal, ...catData.counts }

  const visibleProducts = !session && result ? result.products.slice(0, 8) : (result?.products ?? [])
  const capped = !session && result != null && result.products.length > 8

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setToastMsg(t.common.copiedToClipboard)
  }, [t])

  return (
    <Layout>
      {/* ═══ PAGE HEADER ═══ */}
      <section className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <h1
            className="font-black text-sm uppercase tracking-widest bg-neutral text-primary border-2 border-black px-3 py-1 -rotate-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t.products.title}
          </h1>
          <div className="flex-1 h-[3px] bg-black" />
        </div>
        {result && (
          <p className="text-xs font-bold text-neutral/60">
            {result.total} produk ditemukan
          </p>
        )}
      </section>

      {/* ═══ FILTER BAR (sticky) ═══ */}
      <FilterBar
        categories={categories}
        active={category}
        onChange={(cat) => updateParam('category', cat)}
        counts={categoryCounts}
        sort={sort}
        onSortChange={(s) => updateParam('sort', s)}
        view={view}
        onViewChange={(v) => updateParam('view', v)}
        searchQuery={search}
        onSearchChange={(q) => updateParam('search', q)}
        searchRef={searchRef}
      />

      {/* ═══ PRODUCT GRID ═══ */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !result?.products.length ? (
        <div className="text-center py-12 bg-white border-comic shadow-comic p-8">
          <p className="font-black text-sm uppercase text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Tidak ada produk
          </p>
          <button
            onClick={() => setSearchParams(new URLSearchParams())}
            className="mt-3 bg-white border-2 border-black font-black text-xs uppercase px-4 py-2 shadow-comic-sm btn-comic-interactive"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Hapus Filter
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-start">
          {visibleProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              view="grid"
              onBuy={() => navigate(`/products/${product.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
          {visibleProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              view="list"
              onBuy={() => navigate(`/products/${product.id}`)}
            />
          ))}
        </div>
      )}

      {/* ═══ GUEST CAP BANNER ═══ */}
      {capped && (
        <div className="mt-3 bg-neutral border-comic shadow-comic p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="font-black text-xs uppercase text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.products.loginForMore}
          </p>
          <Link
            to="/login"
            className="bg-primary text-black font-black text-xs uppercase border-2 border-black px-5 py-2 shadow-comic-sm btn-brutal-interactive shrink-0"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t.auth.signIn}
          </Link>
        </div>
      )}

      {/* ═══ PAGINATION ═══ */}
      {result && session && <Pagination currentPage={result.page} totalPages={result.totalPages} />}

      {/* ═══ TOAST ═══ */}
      {toastMsg && <CopyToast message={toastMsg} onDone={() => setToastMsg('')} />}
    </Layout>
  )
}
