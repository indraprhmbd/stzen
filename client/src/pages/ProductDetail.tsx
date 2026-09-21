import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiV1, apiV1Signal, authedApiRequest } from '../lib/api'
import { initiatePayment, deleteOrder } from '../lib/pay'
import { getCachedDetail, prefetchList, setCachedDetail } from '../lib/prefetch'
import { useToast } from '../hooks/useToast'
import ToastStack from '../components/Toast'
import { usePublicSettings, refreshPublicSettings } from '../hooks/usePublicSettings'
import Layout from '../components/Layout'
import SkeletonDetail from '../components/SkeletonDetail'
import ProductCard from '../components/ProductCard'
import { useBrand } from '../hooks/useBrand'
import { useRafScroll } from '../hooks/useRafScroll'
import { useCopy } from '../hooks/useCopy'
import { useAuth } from '../hooks/useAuth'
import { formatIdNumber } from '../lib/format'

// Lazy: description sits below related products, parser never costs paint.
const Markdown = lazy(() => import('../components/Markdown'))

type Product = {
  id: string
  name: string
  overview: string | null
  description: string | null
  category: string
  price: string
  compareAtPrice?: number | null
  badge: string | null
  stockCount: number
  fulfillmentType?: string
  isActive: boolean
  requiresDeliveryInfo?: boolean
}

// Automated rail needs the gateway key AND a price at/above its floor.
// Cheap variants stay manual-only (server rejects sumopod fail-closed).
function buildRails(methods: string[], price: string | number | null | undefined, minAmount: number): ('manual' | 'sumopod')[] {
  if (!methods.includes('sumopod')) return ['manual']
  const p = Number(price)
  if (price == null || !Number.isFinite(p) || p < minAmount) return ['manual']
  return ['manual', 'sumopod']
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBuy = useCallback((id: string) => navigate(`/products/${id}`), [navigate])
  const brand = useBrand()
  const { t } = useCopy()
  const { session } = useAuth()
  const settings = usePublicSettings()
  // Server-gated rails: sumopod only when its key is configured AND the
  // variant price clears the gateway floor (settings fall back to
  // manual-only while loading). Manual always available.
  const [rails, setRails] = useState<('manual' | 'sumopod')[]>(() =>
    buildRails(settings.paymentMethods, id ? getCachedDetail<Product>(id)?.price : undefined, settings.sumopodMinAmount)
  )
  // Fresh floor per dialog open (mirrors rails revalidation below).
  const [minAmount, setMinAmount] = useState(settings.sumopodMinAmount)
  const [method, setMethod] = useState<'manual' | 'sumopod'>('manual')
  const [account, setAccount] = useState('')
  const [wa, setWa] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [placed, setPlaced] = useState<{ id: string; product: string } | null>(null)
  const [product, setProduct] = useState<Product | null>(() => (id ? getCachedDetail<Product>(id) : null))
  const [related, setRelated] = useState<Product[]>([])
  // Prefetched hit paints instantly - skip the skeleton, revalidate silently.
  const [loading, setLoading] = useState(() => !(id && getCachedDetail<Product>(id)))
  const [purchasing, setPurchasing] = useState(false)
  const [msg, setMsg] = useState('')
  const { toasts, showToast, dismissToast } = useToast()
  const [showStickyBar, setShowStickyBar] = useState(false)
  // Mirrors BottomNav hide rule (scroll down past 80px): the sticky bar
  // docks to viewport bottom when the nav hides, sits above it otherwise.
  const [navHidden, setNavHidden] = useState(false)
  const lastY = useRef(0)
  const ctaRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!id) return
    // Related-tap swaps id fast: abort the old chain + ignore its late
    // responses so a slow fetch can't overwrite the new product.
    const controller = new AbortController()
    let active = true
    const client = apiV1Signal(controller.signal)
    // Same-component id change (related click): swap to cache or blank first.
    const hit = getCachedDetail<Product>(id)
    if (hit) {
      setProduct(hit)
    } else {
      setProduct(null)
      setLoading(true)
    }
    client.products[':id'].$get({ param: { id } }).then(async (res) => {
      if (!active) return
      if (res.ok) {
        const data = (await res.json()) as Product
        if (!active) return
        setProduct(data)
        setCachedDetail(id, data)
        // Fetch related products (same category). Plain object: hono/client
        // serializes query via Object.entries, which drops URLSearchParams.
        client.products.$get({ query: { category: data.category, limit: '4' } }).then(async (relRes) => {
          if (!active) return
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
      if (active) setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [id])

  // IntersectionObserver to detect when main CTA scrolls out of view
  useEffect(() => {
    if (!ctaRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry!.isIntersecting)
      },
      { threshold: 0 }
    )
    observer.observe(ctaRef.current)
    return () => observer.disconnect()
  }, [product])

  // Same scroll contract as BottomNav: hide past 80px scrolling down.
  useRafScroll((y) => {
    setNavHidden(y > lastY.current && y > 80)
    lastY.current = y
  })

  async function openBuyConfirm() {
    if (!product || purchasing || !inStock) return
    // Guests skip the dialog entirely: checkout is authed, and opening the
    // form first would discard everything at the login redirect.
    if (!session) {
      navigate('/login')
      return
    }
    // Paint instantly from cache: the two revalidations below used to block
    // the dialog on slow mobile networks. Server re-validates everything
    // fail-closed at order time, so a stale-open self-corrects on confirm.
    const cachedRails = buildRails(settings.paymentMethods, Number(product.price), minAmount)
    setRails(cachedRails)
    // Fresh dialog state every open: default rail prefers automation, form
    // cleared, previous manual receipt discarded.
    setMethod(cachedRails.includes('sumopod') ? 'sumopod' : 'manual')
    setAccount('')
    setWa('')
    setAgreed(false)
    setFormErr('')
    setPlaced(null)
    ;(document.getElementById('buy-confirm') as HTMLDialogElement | null)?.showModal()
    // Fresh viewport every open: the box keeps scroll position across
    // opens, so reset to top alongside the form state above.
    document.querySelector('#buy-confirm .modal-box')?.scrollTo({ top: 0 })
    // showModal() focuses the first field (Chrome), popping the mobile
    // keyboard on open. Drop focus: user taps the field they want.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    // Background revalidate: admin may have flipped requiresDeliveryInfo
    // (or price/stock/rails) after this page loaded. Silent overwrite keeps
    // the open dialog honest without blocking the tap.
    const pid = product.id
    try {
      // One waterfall instead of two: product fetch and settings revalidate
      // are independent, run concurrently; rails build after both settle.
      const [res, freshSettings] = await Promise.all([
        apiV1.products[':id'].$get({ param: { id: pid } }),
        refreshPublicSettings().catch(() => null),
      ])
      if (!res.ok) return
      const fresh = await res.json() as Product
      setProduct(fresh)
      if (freshSettings) {
        setMinAmount(freshSettings.sumopodMinAmount)
        const rails = buildRails(freshSettings.paymentMethods, Number(fresh.price), freshSettings.sumopodMinAmount)
        setRails(rails)
        setMethod((m) => (rails.includes(m) ? m : rails.includes('sumopod') ? 'sumopod' : 'manual'))
      }
    } catch { /* keep cached paint */ }
  }

  // Client mirror of the server contact + consent rules (server re-validates
  // fail-closed). Empty string = valid, set when blocking.
  function validateContact(): string {
    if (settings.termsBody.trim() && !agreed) return t.products.errTerms
    if (!product?.requiresDeliveryInfo) return ''
    if (account.trim().length < 3 || account.trim().length > 120) return t.products.errAccount
    const digits = wa.replace(/[^\d]/g, '').replace(/^0/, '62')
    if (!/^62[89]\d{7,12}$/.test(digits)) return t.products.errWa
    return ''
  }

  function confirmBuy() {
    const err = validateContact()
    if (err) {
      setFormErr(err)
      return
    }
    setFormErr('')
    void handleBuy()
  }

  async function handleBuy() {
    if (!product || purchasing) return
    setPurchasing(true)
    // From the click on, the whole dialog is frozen (inputs + rail + close):
    // the method locks at order creation and retries reuse the idempotency
    // key, so nothing the buyer does here can switch rails mid-flight.
    const idempotencyKey = crypto.randomUUID()
    let oid = ''
    try {
      const res = await authedApiRequest(
        (c) => c.api.v1.checkout.$post({
          json: {
            productId: product.id,
            paymentMethod: method,
            customerAccount: account.trim(),
            waNumber: wa.trim(),
            ...(settings.termsBody.trim() ? { termsAcceptedAt: new Date().toISOString() } : {}),
          },
        }),
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
      if (!res.ok) {
        const err = await res.json() as any
        showToast(err.error || 'Gagal', 'error')
        return
      }
      const data = await res.json() as any
      oid = typeof data.orderId === 'string' ? data.orderId : data.orderId?.id ?? ''
      if (method === 'manual') {
        // No invoice to mint: the order sits PENDING for admin approval.
        // Keep the dialog open on the WA-confirmation receipt.
        setPlaced({ id: oid, product: product.name })
        return
      }
      // SumoPod-only: mint the invoice, then leave for the payment link.
      setMsg('Membuat pembayaran…')
      const checkoutUrl = await initiatePayment(oid)
      ;(document.getElementById('buy-confirm') as HTMLDialogElement | null)?.close()
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        navigate('/dashboard')
      }
    } catch (e: any) {
      if (e?.message && e.message !== 'Not authenticated') {
        // Initiate failed after checkout: remove the dead PENDING row so the
        // dashboard stays clean (server refuses when already invoiced - then
        // the order is real and dashboard BAYAR retries it).
        if (oid) await deleteOrder(oid).catch(() => null)
        setMsg('')
        showToast(e.message, 'error')
      } else {
        navigate('/login')
      }
    } finally { setPurchasing(false) }
  }

  if (loading) return <Layout><SkeletonDetail /></Layout>
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
          {product.overview && (
            <p className="text-sm font-bold text-neutral/80 leading-snug max-w-prose mb-3">
              {product.overview}
            </p>
          )}
          {/* Plain tag links: common blog style, comma-separated. */}
          <p className="text-xs font-bold text-neutral/60">
            Tags:{' '}
            <Link
              to={`/products?category=${encodeURIComponent(product.category)}`}
              onMouseEnter={() => prefetchList({ category: product.category })}
              aria-label={t.products.viewCategory.replace('{category}', product.category)}
              className="underline underline-offset-2 text-blue-700 hover:text-black"
            >
              {product.category}
            </Link>
            {(product.badge ?? '').split(';').map((b) => b.trim()).filter(Boolean).map((b) => (
              <span key={b}>
                {', '}
                <Link
                  to={`/products?tags=${encodeURIComponent(b)}`}
                  onMouseEnter={() => prefetchList({ tags: b })}
                  aria-label={t.products.viewBadge.replace('{badge}', b)}
                  className="underline underline-offset-2 text-blue-700 hover:text-black"
                >
                  {b}
                </Link>
              </span>
            ))}
          </p>
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
              <span className="bg-panel-dark text-white font-black text-xs px-2.5 py-1 border-2 border-black">
                On Demand
              </span>
            )}
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 mb-4">
            <div className="font-black text-4xl text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {brand.storefront.currencySymbol} {formatIdNumber(product.price)}
            </div>
            {pct !== null && (
              <s className="text-sm font-bold text-neutral/50">
                {brand.storefront.currencySymbol} {formatIdNumber(product.compareAtPrice)}
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
            onClick={openBuyConfirm}
            disabled={purchasing || !inStock}
            className="btn btn-primary border-comic shadow-comic btn-comic-interactive font-black uppercase w-full min-h-12 text-sm"
          >
            {purchasing ? t.products.processing : (inStock ? t.products.buyNow : t.products.soldOut)}
          </button>

          {/* Success message */}
          {msg && (
            <div className="mt-3 bg-primary/20 border-2 border-black p-2 text-xs font-bold">
              {msg}
            </div>
          )}

          {/* Back link: history back preserves scroll/filter/page, with
              fallback to /products on direct landing (no inward history).
              ProductList remounts on this nav and always revalidates its
              fetch, so the list paints fresh, never stale. */}
          <button
            onClick={() => {
              const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
              if (idx > 0) navigate(-1)
              else navigate('/products')
            }}
            className="mt-3 flex items-center justify-center gap-2 border-2 border-black font-black text-[10px] uppercase px-3 py-2 bg-white text-black hover:bg-panel-dark hover:text-white transition-colors w-full cursor-pointer"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
            KEMBALI KE PRODUK
          </button>
        </div>
      </div>

      {/* ═══ RELATED PRODUCTS ═══ */}
      {related.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-black text-xs uppercase tracking-widest bg-panel-dark text-white border-2 border-black px-2 py-0.5 -rotate-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              PRODUK TERKAIT
            </h2>
            <div className="flex-1 h-[3px] bg-panel-dark" />
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
                  onBuy={goBuy}
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
                  onBuy={goBuy}
                  view="grid"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ DESCRIPTION (accordion, open by default) ═══ */}
      {product.description && (
        <details open className="mb-4 bg-white border-comic shadow-comic group">
          <summary className="p-3 border-b-2 border-black flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="font-black text-xs uppercase text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Deskripsi Produk
            </span>
            <svg className="w-4 h-4 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div className="px-4 py-3">
            <Suspense fallback={<p className="text-sm font-bold text-neutral/80 leading-relaxed whitespace-pre-line">{product.description}</p>}>
              <Markdown source={product.description} />
            </Suspense>
          </div>
        </details>
      )}

      {/* ═══ STICKY ADD-TO-CART BAR (mobile only) ═══ */}
      {showStickyBar && inStock && (
        <div
          className={`fixed ${navHidden ? 'bottom-0' : 'bottom-14'} left-0 right-0 z-40 bg-white border-t-[3px] border-black px-4 py-2.5 flex items-center justify-between gap-3 md:hidden transition-all duration-200`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-black text-[10px] uppercase text-neutral truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {product.name}
            </p>
            <p className="font-black text-sm text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {brand.storefront.currencySymbol} {formatIdNumber(product.price)}
              {pct !== null && (
                <>
                  {' '}<s className="text-[10px] font-bold text-neutral/50">
                    {brand.storefront.currencySymbol} {formatIdNumber(product.compareAtPrice)}
                  </s>
                  {' '}<span className="rounded-full border border-black text-black text-[9px] px-1.5 py-0.5">
                    -{pct}%
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={openBuyConfirm}
            disabled={purchasing}
            className="bg-primary border-2 border-black font-black text-xs uppercase px-4 py-2.5 btn-comic-interactive shrink-0"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {purchasing ? '...' : t.products.buy}
          </button>
        </div>
      )}
      {/* ═══ FLOATING WA ADMIN BUBBLE (bottom-right) ═══ */}
      {/* Mobile docks above the sticky bar + BottomNav when visible
          (bar ~69px, nav ~59px), else above the nav alone; desktop pins
          bottom-6. Hidden until settings.whatsapp loads. */}
      {product && settings.whatsapp.replace(/[^\d]/g, '') !== '' && (
        <a
          href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
            t.products.askAdminText.replace('{product}', product.name)
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.products.askAdmin}
          className={`group fixed right-4 md:right-6 z-40 md:bottom-6 transition-all duration-200 ${
            showStickyBar && inStock
              ? navHidden ? 'bottom-[84px]' : 'bottom-[140px]'
              : navHidden ? 'bottom-5' : 'bottom-[72px]'
          }`}
        >
          <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 whitespace-nowrap bg-panel-dark text-white font-black text-xs uppercase px-2.5 py-1.5 border-2 border-black shadow-comic opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.products.askAdmin}
          </span>
          <span className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#25D366] border-2 border-black shadow-comic btn-comic-interactive">
            <svg className="w-6 h-6 md:w-7 md:h-7 fill-white" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </span>
        </a>
      )}
      {/* ═══ BUY CONFIRM MODAL (receipt style) ═══ */}
      <dialog id="buy-confirm" className="modal">
        <div className="modal-box bg-white border-comic shadow-comic rounded-sm p-0 max-w-md w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <div className="bg-panel-dark border-b-[3px] border-black px-5 py-3 text-center">
            <h3 className="font-black text-sm uppercase text-primary tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {t.products.confirmTitle}
            </h3>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {placed ? (
              <>
                <div className="bg-primary/20 border-2 border-black p-3 text-center">
                  <p className="font-black text-sm uppercase text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t.products.manualPlaced}
                  </p>
                  <p className="font-mono text-xs font-bold text-neutral mt-1">
                    #{placed.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="bg-white border-2 border-black p-2.5 text-xs font-bold text-neutral leading-relaxed">
                  {t.products.manualPlacedNote}
                </div>
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                    t.products.waConfirmText.replace('{id}', placed.id.slice(0, 8).toUpperCase()).replace('{product}', placed.product)
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary border-2 border-black font-black text-xs uppercase py-2.5 btn-comic-interactive flex items-center justify-center"
                >
                  {t.products.waConfirm}
                </a>
                <button
                  onClick={() => {
                    ;(document.getElementById('buy-confirm') as HTMLDialogElement | null)?.close()
                    navigate('/dashboard')
                  }}
                  className="w-full bg-white text-black font-black text-xs uppercase border-2 border-black py-2.5 hover:bg-panel-dark hover:text-white transition-colors"
                >
                  {t.payment.toDashboard}
                </button>
              </>
            ) : (
              <>
            <div className="border-2 border-dashed border-black/60 px-4 py-3 font-mono text-xs text-neutral">
              <div className="flex justify-between gap-3 py-1">
                <span className="opacity-60">PRODUK</span>
                <span className="font-bold text-right break-words">{product.name}</span>
              </div>
              <div className="flex justify-between gap-3 py-1">
                <span className="opacity-60">HARGA</span>
                <span className="font-bold whitespace-nowrap">{brand.storefront.currencySymbol} {formatIdNumber(pct !== null ? product.compareAtPrice : product.price)}</span>
              </div>
              {pct !== null && (
                <div className="flex justify-between gap-3 py-1">
                  <span className="opacity-60">DISKON</span>
                  <span className="font-bold whitespace-nowrap">-{brand.storefront.currencySymbol}{formatIdNumber(Number(product.compareAtPrice) - Number(product.price))} ({pct}%)</span>
                </div>
              )}
              <div className="flex justify-between gap-3 py-1">
                <span className="opacity-60">QTY</span>
                <span className="font-bold whitespace-nowrap">1</span>
              </div>
              {method === 'sumopod' && (
                <div className="flex justify-between gap-3 py-1">
                  <span className="opacity-60">{t.products.feeLabel}</span>
                  <span className="font-bold whitespace-nowrap">+{brand.storefront.currencySymbol} {formatIdNumber(Math.ceil(Number(product.price) * settings.sumopodFeePct) + settings.sumopodFeeFixed)}</span>
                </div>
              )}
              <div className="border-t-2 border-dashed border-black/60 mt-2 pt-2 flex justify-between items-center gap-3">
                <span className="font-black text-sm">TOTAL</span>
                <span className="font-black text-xl whitespace-nowrap">{brand.storefront.currencySymbol} {formatIdNumber(method === 'sumopod' ? Number(product.price) + Math.ceil(Number(product.price) * settings.sumopodFeePct) + settings.sumopodFeeFixed : product.price)}</span>
              </div>
            </div>
            {rails.length > 1 && (
              <div>
                <p className="font-black text-[10px] uppercase tracking-widest text-neutral mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {t.products.methodTitle}
                </p>
                <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={t.products.methodTitle}>
                  {rails.includes('sumopod') && (
                    <label className={`flex items-start gap-2 border-2 border-black p-2.5 text-xs ${method === 'sumopod' ? 'bg-primary/20' : 'bg-white'} ${purchasing ? 'opacity-60' : 'cursor-pointer'}`}>
                      <input
                        type="radio"
                        name="pay-method"
                        checked={method === 'sumopod'}
                        disabled={purchasing}
                        onChange={() => setMethod('sumopod')}
                        className="radio radio-xs mt-0.5"
                      />
                      <span>
                        <span className="font-black uppercase block">{t.products.methodAuto}</span>
                        <span className="font-bold text-neutral/70">{t.products.methodAutoDesc}</span>
                      </span>
                    </label>
                  )}
                  <label className={`flex items-start gap-2 border-2 border-black p-2.5 text-xs ${method === 'manual' ? 'bg-primary/20' : 'bg-white'} ${purchasing ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="pay-method"
                      checked={method === 'manual'}
                      disabled={purchasing}
                      onChange={() => setMethod('manual')}
                      className="radio radio-xs mt-0.5"
                    />
                    <span>
                      <span className="font-black uppercase block">{t.products.methodManual}</span>
                      <span className="font-bold text-neutral/70">{t.products.methodManualDesc}</span>
                    </span>
                  </label>
                </div>
              </div>
            )}
            {product.requiresDeliveryInfo && (
              <div className="flex flex-col gap-2">
                <label className="block">
                  <span className="font-black text-[10px] uppercase tracking-widest text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t.products.accountLabel}
                    <span className="text-error" aria-hidden="true"> *</span>
                  </span>
                  <input
                    type="text"
                    value={account}
                    disabled={purchasing}
                    onChange={(e) => setAccount(e.target.value)}
                    placeholder={t.products.accountPlaceholder}
                    maxLength={120}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="input input-bordered bg-white border-2 border-black font-bold text-xs w-full mt-1 rounded-sm disabled:opacity-60"
                  />
                </label>
                <label className="block">
                  <span className="font-black text-[10px] uppercase tracking-widest text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t.products.waLabel}
                    <span className="text-error" aria-hidden="true"> *</span>
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={wa}
                    disabled={purchasing}
                    onChange={(e) => setWa(e.target.value)}
                    placeholder={t.products.waPlaceholder}
                    maxLength={20}
                    autoComplete="tel"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="input input-bordered bg-white border-2 border-black font-mono font-bold text-xs w-full mt-1 rounded-sm disabled:opacity-60"
                  />
                </label>
                {formErr && (
                  <p className="text-[11px] font-bold text-error">{formErr}</p>
                )}
              </div>
            )}
            <div className="bg-primary/20 border-2 border-black p-2.5 text-xs font-bold text-neutral leading-relaxed">
              {t.products.confirmNote}
            </div>
            {/* S&K consent: checkbox + collapsible admin-configured text.
                CTA stays clickable so the error path (not silence) teaches
                the requirement; server re-validates fail-closed. */}
            {settings.termsBody.trim() && (
              <div className="bg-white border-2 border-black p-2.5 flex flex-col gap-2">
                <details open>
                  <summary className="text-[11px] font-black uppercase tracking-wide text-neutral cursor-pointer underline underline-offset-2">
                    {t.products.termsShow}
                  </summary>
                  <div className="mt-1.5 max-h-40 overflow-y-auto text-[11px] font-bold text-neutral/80 leading-relaxed whitespace-pre-wrap">
                    {settings.termsBody}
                  </div>
                </details>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <Link to="/syarat-ketentuan" className="text-[10px] font-black uppercase underline underline-offset-2 text-neutral/70 hover:text-neutral">{t.footer.terms}</Link>
                  <Link to="/kebijakan-privasi" className="text-[10px] font-black uppercase underline underline-offset-2 text-neutral/70 hover:text-neutral">{t.footer.privacy}</Link>
                  <Link to="/pengembalian-dana" className="text-[10px] font-black uppercase underline underline-offset-2 text-neutral/70 hover:text-neutral">{t.footer.refunds}</Link>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    disabled={purchasing}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="checkbox checkbox-xs rounded-sm mt-0.5 border-2 border-black bg-white"
                  />
                  <span className="text-[11px] font-bold text-neutral leading-snug">{t.products.termsAgree}</span>
                </label>
              </div>
            )}
            {/* Manual consent: admin hours. Shown whenever the manual rail
                is the chosen/defaulted method, single-rail or radio. */}
            {method === 'manual' && (
              <div className="bg-white border-2 border-black p-2.5 text-xs font-bold text-neutral leading-relaxed flex items-start gap-2">
                <span className="material-symbols-outlined text-base leading-none mt-0.5">schedule</span>
                <span>{t.products.methodManualHours}</span>
              </div>
            )}
            <div className="flex gap-2">
              <form method="dialog" className="flex-1">
                <button disabled={purchasing} className="w-full bg-white text-black font-black text-xs uppercase border-2 border-black py-2.5 hover:bg-panel-dark hover:text-white transition-colors disabled:opacity-50">
                  {t.products.confirmCancel}
                </button>
              </form>
              <button
                onClick={confirmBuy}
                disabled={purchasing || validateContact() !== ''}
                className="flex-1 btn btn-primary border-2 border-black font-black text-xs uppercase py-2.5 btn-comic-interactive disabled:opacity-50 flex items-center justify-center gap-2 leading-none"
              >
                <span>{purchasing ? t.products.processing : (method === 'manual' ? t.products.confirmPlace : t.products.confirmGo)}</span>
                {!purchasing && method === 'sumopod' && <img src="/QRIS_logo.svg" alt="QRIS" className="h-3 w-auto" />}
              </button>
            </div>
              </>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button disabled={purchasing}>close</button>
        </form>
      </dialog>
      <ToastStack toasts={toasts} onDone={dismissToast} />
    </Layout>
  )
}
