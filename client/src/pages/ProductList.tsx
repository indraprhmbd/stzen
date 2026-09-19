import { useState, useEffect, useRef, useCallback, startTransition } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiV1Signal } from '../lib/api'
import { listKey, getCachedList, setCachedList, prefetchList } from '../lib/prefetch'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
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
  overview: string | null
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
  // Repeated ?tags= params, normalized to trigger-written form (UPPER).
  const activeTags = searchParams.getAll('tags').map((t) => t.toUpperCase()).filter(Boolean)
  // Stable string key: activeTags is a fresh array every render, so effects
  // and memo keys below depend on this instead (else infinite refetch).
  const activeTagKey = activeTags.join(',')
  const sort = searchParams.get('sort') || 'newest'
  const page = parseInt(searchParams.get('page') || '1')
  const search = searchParams.get('search') || ''
  const view = isMobile ? 'grid' : ((searchParams.get('view') as 'grid' | 'list') || 'list')

  const [result, setResult] = useState<PaginatedResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')
  // Stable ref for memo(ProductCard): inline closures kill the memo.
  const goBuy = useCallback((id: string) => navigate(`/products/${id}`), [navigate])
  const [catData, setCatData] = useState<{ categories: string[]; counts: Record<string, number> }>({ categories: ['all'], counts: {} })
  const [tagData, setTagData] = useState<{ tags: string[]; counts: Record<string, number> }>({ tags: [], counts: {} })
  // Category pill deep-links land here mid-scroll: reset viewport on change.
  const prevFilter = useRef(`${category}|${activeTagKey}`)

  // Fetch full category + tag lists once (independent of active filter)
  useEffect(() => {
    const controller = new AbortController()
    const client = apiV1Signal(controller.signal)
    client.products.categories.$get().then(async (res) => {
      if (res.ok) {
        const data = await res.json() as { categories: string[]; counts: Record<string, number> }
        setCatData({ categories: ['all', ...data.categories], counts: data.counts })
      }
    }).catch(() => {})
    client.products.tags.$get().then(async (res) => {
      if (res.ok) {
        const data = await res.json() as { tags: string[]; counts: Record<string, number> }
        setTagData(data)
      }
    }).catch(() => {})
    return () => controller.abort()
  }, [])

  // Fetch products on every URL param change - cache-first: back-nav and
  // prefetched pages paint instantly, then revalidate silently.
  useEffect(() => {
    const controller = new AbortController()
    const client = apiV1Signal(controller.signal)
    let cancelled = false

    if (prevFilter.current !== `${category}|${activeTagKey}`) {
      prevFilter.current = `${category}|${activeTagKey}`
      window.scrollTo(0, 0)
    }

    const query: Record<string, string | string[]> = {}
    if (category !== 'all') query.category = category
    if (activeTags.length > 0) query.tags = activeTags
    if (sort !== 'newest') query.sort = sort
    if (page > 1) query.page = String(page)
    if (search) query.search = search
    // Guests only ever see 8: cap server-side so the API never ships 24.
    if (!session) query.limit = '8'

    const key = listKey(query)
    const cached = getCachedList<PaginatedResult>(key)
    const hit = cached && Array.isArray((cached as any).products) ? cached : null
    if (hit) {
      setResult(hit)
      setLoading(false)
    } else {
      setLoading(true)
    }

    client.products.$get({ query }).then(async (res) => {
      if (cancelled) return
      if (res.ok) {
        const data = (await res.json()) as PaginatedResult
        // Normalize once: any shape drift (proxy error page, validator union,
        // stale cache entry) becomes an empty list instead of a render crash.
        const products = Array.isArray((data as any)?.products) ? (data as any).products : []
        if (!Array.isArray((data as any)?.products)) console.warn('[products] unexpected list shape', key)
        const normalized = { ...(data as object), products } as PaginatedResult
        setCachedList(key, normalized)
        setResult(normalized)
      }
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true; controller.abort() }
  }, [category, activeTagKey, sort, page, search, session])

  // Pre-warm page+1 while the pager is on screen (Pagination calls this once
  // per page via viewport observer). Guests get no pager - nothing to warm.
  const prefetchNextPage = useCallback(() => {
    if (!session) return
    const totalPages = result?.totalPages ?? 1
    if (page >= totalPages) return
    const query: Record<string, string | string[]> = {}
    if (category !== 'all') query.category = category
    if (activeTags.length > 0) query.tags = activeTags
    if (sort !== 'newest') query.sort = sort
    query.page = String(page + 1)
    if (search) query.search = search
    prefetchList(query)
  }, [category, activeTagKey, sort, page, search, session, result?.totalPages])

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

  // Helper: update URL params, reset to page 1 on filter change.
  // Transition keeps typing/filter taps responsive while the fetch runs.
  function updateParam(key: string, value: string) {
    startTransition(() => {
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
    })
  }

  // Tag picker: toggles one repeated ?tags= value, keeps the rest.
  function toggleTag(tag: string) {
    startTransition(() => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev)
        const cur = params.getAll('tags').map((t) => t.toUpperCase())
        params.delete('tags')
        for (const t of cur.filter((t) => t !== tag)) params.append('tags', t)
        if (!cur.includes(tag)) params.append('tags', tag)
        params.delete('page')
        return params
      })
    })
  }

  // Tag picker footer: drops every ?tags= value at once.
  function clearTags() {
    startTransition(() => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev)
        params.delete('tags')
        params.delete('page')
        return params
      })
    })
  }

  const categories = catData.categories
  const allTotal = Object.values(catData.counts).reduce((a, b) => a + b, 0)
  const categoryCounts: Record<string, number> = { all: allTotal, ...catData.counts }

  const visibleProducts = !session && result ? result.products.slice(0, 8) : (result?.products ?? [])
  // Server caps guests at 8 - banner shows whenever more exist beyond the cap.
  const capped = !session && (result?.total ?? 0) > (result?.products.length ?? 0)

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
        availableTags={tagData.tags}
        tagCounts={tagData.counts}
        activeTags={activeTags}
        onToggleTag={toggleTag}
        onClearTags={clearTags}
      />

      {/* ═══ PRODUCT GRID ═══ */}
      {loading ? (
        view === 'list' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} view="list" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} view="grid" />
            ))}
          </div>
        )
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
              onBuy={goBuy}
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
              onBuy={goBuy}
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
      {result && session && <Pagination currentPage={result.page} totalPages={result.totalPages} onPrefetchNext={prefetchNextPage} />}

      {/* ═══ TOAST ═══ */}
      {toastMsg && <CopyToast message={toastMsg} onDone={() => setToastMsg('')} />}
    </Layout>
  )
}
