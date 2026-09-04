import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiV1, authedApiRequest } from '../lib/api'
import Layout from '../components/Layout'
import ProductCard from '../components/ProductCard'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

type Product = {
  id: string
  name: string
  description: string | null
  category: string
  price: string
  compareAtPrice?: number | null
  badge: string | null
  stockCount: number
  fulfillmentType?: string
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const brand = useBrand()
  const { t } = useCopy()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [msg, setMsg] = useState('')
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const ctaRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiV1.products[':id'].$get({ param: { id } }).then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as Product
        setProduct(data)
        // Fetch related products (same category). Plain object: hono/client
        // serializes query via Object.entries, which drops URLSearchParams.
        apiV1.products.$get({ query: { category: data.category, limit: '4' } }).then(async (relRes) => {
          if (relRes.ok) {
            const relData = await relRes.json()
            const products = Array.isArray(relData) ? relData : relData.products || []
            const filtered = products
              .filter((p: Product) => p.id !== data.id)
              .filter((p: Product) => p.fulfillmentType === 'on_demand' || (p.stockCount ?? 0) > 0)
              .slice(0, 4)
            setRelated(filtered)
          }
        }).catch(() => {})
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  // IntersectionObserver to detect when main CTA scrolls out of view
  useEffect(() => {
    if (!ctaRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting)
      },
      { threshold: 0 }
    )
    observer.observe(ctaRef.current)
    return () => observer.disconnect()
  }, [product])

  async function handleBuy() {
    if (!product || purchasing) return
    setPurchasing(true)
    // One key per buy-intent: double-clicks and network retries reuse it, so
    // the server returns the original order instead of minting duplicates.
    const idempotencyKey = crypto.randomUUID()
    try {
      const res = await authedApiRequest(
        (c) => c.api.v1.checkout.$post({ json: { productId: product.id } }),
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
      if (res.ok) {
        const data = await res.json() as any
        const oid = typeof data.orderId === 'string' ? data.orderId : data.orderId?.id ?? ''
        setMsg(`Order #${oid} dibuat!`)
      } else {
        const err = await res.json() as any
        alert(err.error || 'Gagal')
      }
    } catch {
      navigate('/login')
    } finally { setPurchasing(false) }
  }

  if (loading) return <Layout><div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" /></div></Layout>
  if (!product) return <Layout><div className="text-center py-16"><p>Produk tidak ditemukan</p><Link to="/products" className="btn btn-sm mt-4">Kembali</Link></div></Layout>

  const isOnDemand = product.fulfillmentType === 'on_demand'
  const inStock = isOnDemand || product.stockCount > 0
  const pct = (() => {
    const p = Number(product.price)
    const c = product.compareAtPrice == null ? NaN : Number(product.compareAtPrice)
    if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c <= p) return null
    return Math.round(((c - p) / c) * 100)
  })()

  return (
    <Layout>
      <div className="grid md:grid-cols-[2fr_1fr] gap-3 mb-4">
        {/* ═══ HERO SECTION (left) ═══ */}
        <div className="bg-white border-comic shadow-comic p-5 md:p-6">
          <h1 className="font-black text-3xl md:text-5xl uppercase text-neutral leading-none mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {product.name}
          </h1>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="w-fit rounded-full border border-black text-black text-[10px] uppercase px-2.5 py-0.5 tracking-wide">
              {product.category}
            </span>
            {(product.badge ?? '').split(';').map((b) => b.trim()).filter(Boolean).map((b) => (
              <span key={b} className="w-fit rounded-full border border-black text-black text-[10px] uppercase px-2.5 py-0.5 tracking-wide">
                {b}
              </span>
            ))}
          </div>
          {product.description && (
            <p className="text-sm font-bold text-neutral/80 leading-snug max-w-prose">
              {product.description}
            </p>
          )}
        </div>

        {/* ═══ PURCHASE PANEL (right) ═══ */}
        <div className="bg-white border-comic shadow-comic p-4 flex flex-col">
          {/* Stock indicators */}
          <div className="flex flex-wrap gap-2 mb-3">
            {isOnDemand ? (
              <span className="bg-accent text-neutral font-black text-xs border-2 border-black px-2.5 py-1 rotate-1">
                {t.products.inStock}
              </span>
            ) : product.stockCount === 0 ? (
              <span className="bg-error text-white font-black text-xs border-2 border-black px-2.5 py-1 -rotate-1">
                {t.products.outOfStock}
              </span>
            ) : product.stockCount <= 3 ? (
              <span className="bg-warning text-neutral font-black text-xs border-2 border-black px-2.5 py-1 rotate-1">
                ⚡ {product.stockCount} LEFT
              </span>
            ) : (
              <span className="bg-accent text-neutral font-black text-xs border-2 border-black px-2.5 py-1 rotate-1">
                {product.stockCount} LEFT
              </span>
            )}
            {isOnDemand && (
              <span className="bg-neutral text-primary font-black text-xs px-2.5 py-1 border-2 border-black">
                On Demand
              </span>
            )}
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 mb-4">
            <div className="font-black text-4xl text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {brand.storefront.currencySymbol} {Number(product.price).toLocaleString('id-ID')}
            </div>
            {pct !== null && (
              <s className="text-sm font-bold text-neutral/50">
                {brand.storefront.currencySymbol} {Number(product.compareAtPrice).toLocaleString('id-ID')}
              </s>
            )}
            {pct !== null && (
              <span className="rounded-full border border-black text-black text-xs px-2 py-0.5">
                -{pct}%
              </span>
            )}
          </div>

          {/* CTA */}
          <button
            ref={ctaRef}
            onClick={handleBuy}
            disabled={purchasing || !inStock}
            className="btn btn-primary border-comic shadow-comic btn-comic-interactive font-black uppercase w-full min-h-12 text-sm"
          >
            {purchasing ? 'Memproses...' : (inStock ? 'BELI SEKARANG' : t.products.soldOut)}
          </button>

          {/* Success message */}
          {msg && (
            <div className="mt-3 bg-primary/20 border-2 border-black p-2 text-xs font-bold">
              {msg}
            </div>
          )}

          {/* Back link */}
          <Link
            to="/products"
            className="mt-3 flex items-center justify-center gap-2 border-2 border-black font-black text-[10px] uppercase px-3 py-2 bg-white text-black hover:bg-black hover:text-white transition-colors"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
            KEMBALI KE PRODUK
          </Link>
        </div>
      </div>

      {/* ═══ DESCRIPTION ACCORDION ═══ */}
      {product.description && (
        <div className="mb-4 bg-white border-comic shadow-comic">
          <button
            onClick={() => setDescOpen(!descOpen)}
            className="w-full flex items-center justify-between p-3 border-b-2 border-black"
          >
            <span className="font-black text-xs uppercase text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Deskripsi Produk
            </span>
            <span className={`material-symbols-outlined text-sm transition-transform ${descOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          {descOpen && (
            <div className="p-3">
              <p className="text-sm font-bold text-neutral/80 leading-relaxed">
                {product.description}
              </p>
              {t.products.features && t.products.features.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {t.products.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-bold text-neutral">
                      <span className="material-symbols-outlined text-[14px] text-primary">check_circle</span>
                      {feat}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ RELATED PRODUCTS ═══ */}
      {related.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-black text-xs uppercase tracking-widest bg-neutral text-primary border-2 border-black px-2 py-0.5 -rotate-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              PRODUK TERKAIT
            </h2>
            <div className="flex-1 h-[3px] bg-black" />
          </div>

          {/* Mobile: horizontal scroll */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {related.map((rel) => (
              <div
                key={rel.id}
                className="w-[160px] shrink-0"
              >
                <ProductCard
                  product={rel}
                  onBuy={() => navigate(`/products/${rel.id}`)}
                  view="grid"
                />
              </div>
            ))}
          </div>

          {/* Desktop: 4-col grid */}
          <div className="hidden md:grid md:grid-cols-4 gap-2">
            {related.map((rel) => (
              <div key={rel.id}>
                <ProductCard
                  product={rel}
                  onBuy={() => navigate(`/products/${rel.id}`)}
                  view="grid"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ STICKY ADD-TO-CART BAR (mobile only) ═══ */}
      {showStickyBar && inStock && (
        <div
          className="fixed bottom-14 left-0 right-0 z-40 bg-white border-t-[3px] border-black px-4 py-2.5 flex items-center justify-between gap-3 md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-black text-[10px] uppercase text-neutral truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {product.name}
            </p>
            <p className="font-black text-sm text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {brand.storefront.currencySymbol} {Number(product.price).toLocaleString('id-ID')}
              {pct !== null && (
                <>
                  {' '}<s className="text-[10px] font-bold text-neutral/50">
                    {brand.storefront.currencySymbol} {Number(product.compareAtPrice).toLocaleString('id-ID')}
                  </s>
                  {' '}<span className="rounded-full border border-black text-black text-[9px] px-1.5 py-0.5">
                    -{pct}%
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={handleBuy}
            disabled={purchasing}
            className="bg-primary border-2 border-black font-black text-xs uppercase px-4 py-2.5 btn-comic-interactive shrink-0"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {purchasing ? '...' : 'BELI'}
          </button>
        </div>
      )}
    </Layout>
  )
}
