import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiV1, authedApiRequest } from '../lib/api'
import { initiatePayment, deleteOrder } from '../lib/pay'
import { getCachedDetail } from '../lib/prefetch'
import { useToast } from '../hooks/useToast'
import ToastStack from '../components/Toast'
import { usePublicSettings, refreshPublicSettings } from '../hooks/usePublicSettings'
import Layout from '../components/Layout'
import ProductCard from '../components/ProductCard'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

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

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const brand = useBrand()
  const { t } = useCopy()
  const settings = usePublicSettings()
  // Server-gated rails: sumopod only when its key is configured (settings
  // fall back to manual-only while loading). Manual always available.
  const [rails, setRails] = useState<('manual' | 'sumopod')[]>(() =>
    settings.paymentMethods.includes('sumopod') ? ['manual', 'sumopod'] : ['manual']
  )
  const [method, setMethod] = useState<'manual' | 'sumopod'>('manual')
  const [account, setAccount] = useState('')
  const [wa, setWa] = useState('')
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
  const [descOpen, setDescOpen] = useState(false)
  const ctaRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!id) return
    // Same-component id change (related click): swap to cache or blank first.
    const hit = getCachedDetail<Product>(id)
    if (hit) {
      setProduct(hit)
    } else {
      setProduct(null)
      setLoading(true)
    }
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

  async function openBuyConfirm() {
    if (!product || purchasing || !inStock) return
    // Revalidate before the dialog paints: admin may have flipped
    // requiresDeliveryInfo (or price/stock) after this page loaded, and the
    // prefetch cache would otherwise serve the stale variant. Stale view
    // still opens when the refresh fails.
    try {
      const res = await apiV1.products[':id'].$get({ param: { id: product.id } })
      if (res.ok) setProduct(await res.json() as Product)
    } catch { /* fall through with cached product */ }
    // Rails revalidate alongside: operator key changes bypass the 60s
    // settings cache so the method radio matches server availability.
    let nextRails = rails
    try {
      const fresh = await refreshPublicSettings()
      nextRails = fresh.paymentMethods.includes('sumopod') ? ['manual', 'sumopod'] : ['manual']
      setRails(nextRails)
    } catch { /* fall through with cached rails */ }
    // Fresh dialog state every open: default rail prefers automation, form
    // cleared, previous manual receipt discarded.
    setMethod(nextRails.includes('sumopod') ? 'sumopod' : 'manual')
    setAccount('')
    setWa('')
    setFormErr('')
    setPlaced(null)
    ;(document.getElementById('buy-confirm') as HTMLDialogElement | null)?.showModal()
  }

  // Client mirror of the server contact rules (server re-validates
  // fail-closed). Empty string = valid, set when blocking.
  function validateContact(): string {
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
          {product.overview && (
            <p className="text-sm font-bold text-neutral/80 leading-snug max-w-prose">
              {product.overview}
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
            className="mt-3 flex items-center justify-center gap-2 border-2 border-black font-black text-[10px] uppercase px-3 py-2 bg-white text-black hover:bg-black hover:text-white transition-colors w-full cursor-pointer"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
            KEMBALI KE PRODUK
          </button>
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
              <p className="text-sm font-bold text-neutral/80 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
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
            onClick={openBuyConfirm}
            disabled={purchasing}
            className="bg-primary border-2 border-black font-black text-xs uppercase px-4 py-2.5 btn-comic-interactive shrink-0"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {purchasing ? '...' : t.products.buy}
          </button>
        </div>
      )}
      {/* ═══ BUY CONFIRM MODAL (receipt style) ═══ */}
      <dialog id="buy-confirm" className="modal">
        <div className="modal-box bg-white border-comic shadow-comic rounded-sm p-0 max-w-md">
          <div className="bg-neutral border-b-[3px] border-black px-5 py-3 text-center">
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
                  className="w-full bg-white text-black font-black text-xs uppercase border-2 border-black py-2.5 hover:bg-black hover:text-white transition-colors"
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
                <span className="font-bold whitespace-nowrap">{brand.storefront.currencySymbol} {Number(pct !== null ? product.compareAtPrice : product.price).toLocaleString('id-ID')}</span>
              </div>
              {pct !== null && (
                <div className="flex justify-between gap-3 py-1">
                  <span className="opacity-60">DISKON</span>
                  <span className="font-bold whitespace-nowrap">-{brand.storefront.currencySymbol}{(Number(product.compareAtPrice) - Number(product.price)).toLocaleString('id-ID')} ({pct}%)</span>
                </div>
              )}
              <div className="flex justify-between gap-3 py-1">
                <span className="opacity-60">QTY</span>
                <span className="font-bold whitespace-nowrap">1</span>
              </div>
              <div className="border-t-2 border-dashed border-black/60 mt-2 pt-2 flex justify-between items-center gap-3">
                <span className="font-black text-sm">TOTAL</span>
                <span className="font-black text-xl whitespace-nowrap">{brand.storefront.currencySymbol} {Number(product.price).toLocaleString('id-ID')}</span>
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
                  </span>
                  <input
                    type="text"
                    value={account}
                    disabled={purchasing}
                    onChange={(e) => setAccount(e.target.value)}
                    placeholder={t.products.accountPlaceholder}
                    maxLength={120}
                    className="input input-bordered bg-white border-2 border-black font-bold text-xs w-full mt-1 rounded-sm disabled:opacity-60"
                  />
                </label>
                <label className="block">
                  <span className="font-black text-[10px] uppercase tracking-widest text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t.products.waLabel}
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={wa}
                    disabled={purchasing}
                    onChange={(e) => setWa(e.target.value)}
                    placeholder={t.products.waPlaceholder}
                    maxLength={20}
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
            <div className="flex gap-2">
              <form method="dialog" className="flex-1">
                <button disabled={purchasing} className="w-full bg-white text-black font-black text-xs uppercase border-2 border-black py-2.5 hover:bg-black hover:text-white transition-colors disabled:opacity-50">
                  {t.products.confirmCancel}
                </button>
              </form>
              <button
                onClick={confirmBuy}
                disabled={purchasing}
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
