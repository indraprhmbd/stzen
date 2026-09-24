import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authedApiRequest } from '../lib/api'
import { initiatePayment } from '../lib/pay'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useCopy } from '../hooks/useCopy'
import { useToast } from '../hooks/useToast'
import ToastStack from '../components/Toast'
import { usePublicSettings } from '../hooks/usePublicSettings'
import Layout from '../components/Layout'
import { formatIdNumber } from '../lib/format'

export default function Cart() {
  const { cartId, items, subtotal, itemCount, version, loading, conflict, setQuantity, removeLine, clear, refresh } = useCart()
  const { session } = useAuth()
  const { lang, t } = useCopy()
  const settings = usePublicSettings()
  const navigate = useNavigate()
  const { toasts, showToast, dismissToast } = useToast()
  const [method, setMethod] = useState<'manual' | 'sumopod'>('manual')
  const [account, setAccount] = useState('')
  const [wa, setWa] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [placing, setPlacing] = useState(false)

  const str = {
    title: lang === 'id' ? 'Keranjang' : 'Cart',
    empty: lang === 'id' ? 'Keranjang masih kosong.' : 'Your cart is empty.',
    emptyHint: lang === 'id' ? 'Yuk isi dengan langganan favoritmu.' : 'Fill it with your favorite subs.',
    shop: lang === 'id' ? 'Belanja' : 'Shop',
    remove: lang === 'id' ? 'Hapus' : 'Remove',
    clear: lang === 'id' ? 'Kosongkan' : 'Clear all',
    subtotal: lang === 'id' ? 'Subtotal' : 'Subtotal',
    items: lang === 'id' ? 'barang' : 'items',
    fee: lang === 'id' ? 'Biaya QRIS' : 'QRIS fee',
    total: lang === 'id' ? 'Total bayar' : 'Total',
    checkout: lang === 'id' ? 'Checkout' : 'Checkout',
    loginFirst: lang === 'id' ? 'Masuk dulu untuk checkout.' : 'Sign in to check out.',
    signIn: lang === 'id' ? 'Masuk' : 'Sign in',
    method: lang === 'id' ? 'Pembayaran' : 'Payment',
    manual: lang === 'id' ? 'Manual' : 'Manual',
    qris: 'QRIS',
    accountPh: lang === 'id' ? 'Akun pengiriman (email/ID)' : 'Delivery account (email/ID)',
    waPh: lang === 'id' ? 'No. WhatsApp' : 'WhatsApp number',
    agree: lang === 'id' ? 'Saya setuju S&K' : 'I agree to the Terms',
    errTerms: lang === 'id' ? 'Setujui S&K dulu.' : 'Accept the Terms first.',
    errAccount: lang === 'id' ? 'Akun 3-120 karakter.' : 'Account 3-120 chars.',
    errWa: lang === 'id' ? 'No. WA tidak valid.' : 'Invalid WA number.',
    placing: lang === 'id' ? 'Memproses…' : 'Placing…',
    placed: lang === 'id' ? 'Pesanan dibuat.' : 'Order placed.',
    conflict: lang === 'id' ? 'Keranjang berubah di tab lain, dimuat ulang.' : 'Cart changed elsewhere, reloaded.',
  }

  // SumoPod rail only when the aggregate clears the gateway floor (server
  // re-validates fail-closed). Manual always available.
  const rails: ('manual' | 'sumopod')[] =
    settings.paymentMethods.includes('sumopod') && subtotal >= settings.sumopodMinAmount
      ? ['manual', 'sumopod']
      : ['manual']
  // Effective rail: falls back to manual when the aggregate drops below the
  // gateway floor mid-session (server re-validates fail-closed anyway).
  const effMethod = rails.includes(method) ? method : 'manual'

  // Display-only mirror of the checkout_cart fee (server recomputes and
  // charges the authoritative value at order time).
  const qrisFee = effMethod === 'sumopod' ? Math.ceil(subtotal * 0.007) + 300 : 0

  function validate(): string {
    if (settings.termsBody.trim() && !agreed) return str.errTerms
    if (account.trim() || wa.trim()) {
      if (account.trim().length < 3 || account.trim().length > 120) return str.errAccount
      const digits = wa.replace(/[^\d]/g, '').replace(/^0/, '62')
      if (!/^62[89]\d{7,12}$/.test(digits)) return str.errWa
    }
    return ''
  }

  async function placeOrder() {
    if (placing || items.length === 0 || !cartId) return
    const err = validate()
    if (err) {
      setFormErr(err)
      return
    }
    setFormErr('')
    setPlacing(true)
    try {
      const res = await authedApiRequest(
        (c) => c.api.v1.checkout.cart.$post({
          json: {
            cartId,
            paymentMethod: effMethod,
            customerAccount: account.trim(),
            waNumber: wa.trim(),
            expectedVersion: version,
            ...(settings.termsBody.trim() ? { termsAcceptedAt: new Date().toISOString() } : {}),
          },
        }),
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      )
      if (!res.ok) {
        const e = (await res.json()) as unknown as { error?: string }
        showToast(e.error || 'Gagal', 'error')
        await refresh()
        return
      }
      const data = (await res.json()) as { orderId: string }
      showToast(str.placed, 'success')
      if (effMethod === 'manual') {
        navigate('/dashboard')
        return
      }
      const checkoutUrl = await initiatePayment(data.orderId)
      if (checkoutUrl) window.location.href = checkoutUrl
      else navigate('/dashboard')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Gagal', 'error')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <Layout>
      <ToastStack toasts={toasts} onDone={dismissToast} />

      {/* ═══ HEADER ═══ */}
      <div className="flex items-end justify-between gap-3 mb-4">
        <h1 className="font-black text-4xl md:text-5xl uppercase leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {str.title}
          {itemCount > 0 && (
            <span className="badge badge-lg badge-primary border-brutal shadow-brutal-sm ml-3 align-middle font-black" role="status">
              {itemCount} {str.items}
            </span>
          )}
        </h1>
        {items.length > 0 && (
          <button onClick={() => void clear()} className="font-bold text-xs uppercase underline underline-offset-2 text-neutral/60 hover:text-error shrink-0">
            {str.clear}
          </button>
        )}
      </div>
      {conflict && <p className="bg-warning border-brutal shadow-brutal-sm rounded-sm font-bold text-sm p-2 mb-3">{str.conflict}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
      ) : items.length === 0 ? (
        <div className="bg-white border-brutal-thick shadow-pop-pink rounded-md p-10 text-center">
          <span className="material-symbols-outlined text-5xl mb-2">shopping_cart</span>
          <p className="font-black text-xl uppercase mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{str.empty}</p>
          <p className="text-sm font-bold text-neutral/60 mb-5">{str.emptyHint}</p>
          <Link to="/products" className="btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase">{str.shop}</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-[2fr_1fr] gap-4 items-start">
          {/* ═══ LINES ═══ */}
          <ol className="flex flex-col gap-3">
            {items.map((line) => {
              const discountPct = line.compareAtPrice != null && line.compareAtPrice > line.unitPrice
                ? Math.round(((line.compareAtPrice - line.unitPrice) / line.compareAtPrice) * 100)
                : null
              return (
                <li
                  key={line.variantPublicId}
                  className="bg-white border-comic shadow-comic relative overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-2.5">
                    <div className="flex-1 min-w-0">
                      <Link to={`/products/${line.variantPublicId}`}>
                        <h3 className="font-extrabold text-xs uppercase tracking-tight text-on-surface leading-tight line-clamp-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {line.name}
                        </h3>
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        <span className="w-fit rounded-full border border-black text-black text-[7px] uppercase px-1.5 py-px tracking-wide">
                          {line.quantity} {str.items}
                        </span>
                        {discountPct !== null && (
                          <span className="w-fit rounded-full border border-black text-black text-[7px] uppercase px-1.5 py-px tracking-wide">
                            -{discountPct}%
                          </span>
                        )}
                        <span className="font-mono text-[11px] font-bold text-neutral/60">
                          {formatIdNumber(line.unitPrice)}
                          {line.compareAtPrice != null && (
                            <>
                              {' '}<s>{formatIdNumber(line.compareAtPrice)}</s>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-mono font-black text-base">{formatIdNumber(line.lineTotal)}</p>
                      <div className="join border-brutal rounded-sm bg-white">
                        <button className="btn btn-xs join-item" onClick={() => void setQuantity(line.variantPublicId, line.quantity - 1)} aria-label="decrease">−</button>
                        <span className="join-item px-2 font-mono font-black text-sm flex items-center">{line.quantity}</span>
                        <button className="btn btn-xs join-item" onClick={() => void setQuantity(line.variantPublicId, line.quantity + 1)} aria-label="increase">+</button>
                      </div>
                      <button
                        onClick={() => void removeLine(line.variantPublicId)}
                        aria-label={str.remove}
                        className="w-6 h-6 shrink-0 border-2 border-black bg-white text-error font-black flex items-center justify-center hover:bg-error hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          {/* ═══ SUMMARY + CHECKOUT (receipt style, mirrors buy modal) ═══ */}
          <div className="bg-white border-brutal-thick shadow-pop-lime rounded-md p-0 overflow-hidden md:sticky md:top-16">
            <div className="bg-panel-dark border-b-[3px] border-black px-5 py-3 text-center">
              <h2 className="font-black text-sm uppercase text-primary tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {lang === 'id' ? 'Ringkasan' : 'Summary'}
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="border-2 border-dashed border-black/60 px-4 py-3 font-mono text-xs text-neutral">
                {items.map((line) => (
                  <div key={line.variantPublicId} className="flex justify-between gap-3 py-1">
                    <span className="opacity-60 truncate">{line.name} ×{line.quantity}</span>
                    <span className="font-bold whitespace-nowrap">
                      {line.compareAtPrice != null && <s className="opacity-60 mr-1">{formatIdNumber(line.compareAtPrice * line.quantity)}</s>}
                      {formatIdNumber(line.lineTotal)}
                    </span>
                  </div>
                ))}
                {items.some((l) => l.compareAtPrice != null) && (
                  <div className="flex justify-between gap-3 py-1">
                    <span className="opacity-60">{lang === 'id' ? 'HEMAT' : 'SAVED'}</span>
                    <span className="font-bold whitespace-nowrap text-secondary">
                      −{formatIdNumber(items.reduce((s, l) => s + (l.compareAtPrice != null ? (l.compareAtPrice - l.unitPrice) * l.quantity : 0), 0))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-3 py-1">
                  <span className="opacity-60">{str.subtotal}</span>
                  <span className="font-bold whitespace-nowrap">{formatIdNumber(subtotal)}</span>
                </div>
                {qrisFee > 0 && (
                  <div className="flex justify-between gap-3 py-1">
                    <span className="opacity-60">{str.fee}</span>
                    <span className="font-bold whitespace-nowrap">+{formatIdNumber(qrisFee)}</span>
                  </div>
                )}
                <div className="border-t-2 border-dashed border-black/60 mt-2 pt-2 flex justify-between items-center gap-3">
                  <span className="font-black text-sm">{str.total}</span>
                  <span className="font-black text-xl whitespace-nowrap">{formatIdNumber(subtotal + qrisFee)}</span>
                </div>
              </div>
            {!session ? (
              <div>
                <p className="text-sm font-bold mb-2">{str.loginFirst}</p>
                <Link to="/login" className="btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase w-full">{str.signIn}</Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rails.length > 1 && (
                  <div>
                    <p className="font-black text-[10px] uppercase tracking-widest text-neutral mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {t.products.methodTitle}
                    </p>
                    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={t.products.methodTitle}>
                      {rails.includes('sumopod') && (
                        <label className={`flex items-start gap-2 border-2 border-black p-2.5 text-xs ${effMethod === 'sumopod' ? 'bg-primary/20' : 'bg-white'} ${placing ? 'opacity-60' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="cart-pay-method"
                            checked={effMethod === 'sumopod'}
                            disabled={placing}
                            onChange={() => setMethod('sumopod')}
                            className="radio radio-xs mt-0.5"
                          />
                          <span>
                            <span className="font-black uppercase block">{t.products.methodAuto}</span>
                            <span className="font-bold text-neutral/70">{t.products.methodAutoDesc}</span>
                          </span>
                        </label>
                      )}
                      <label className={`flex items-start gap-2 border-2 border-black p-2.5 text-xs ${effMethod === 'manual' ? 'bg-primary/20' : 'bg-white'} ${placing ? 'opacity-60' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          name="cart-pay-method"
                          checked={effMethod === 'manual'}
                          disabled={placing}
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
                <label className="block">
                  <span className="font-black text-[10px] uppercase tracking-widest text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t.products.accountLabel}
                  </span>
                  <input
                    type="text"
                    value={account}
                    disabled={placing}
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
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={wa}
                    disabled={placing}
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
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="checkbox checkbox-xs rounded-sm mt-0.5 border-2 border-black bg-white"
                      />
                      <span className="text-[11px] font-bold text-neutral leading-snug">{t.products.termsAgree}</span>
                    </label>
                  </div>
                )}
                {effMethod === 'manual' && (
                  <div className="bg-white border-2 border-black p-2.5 text-xs font-bold text-neutral leading-relaxed flex items-start gap-2">
                    <span className="material-symbols-outlined text-base leading-none mt-0.5">schedule</span>
                    <span>{t.products.methodManualHours}</span>
                  </div>
                )}
                {formErr && (
                  <p className="text-[11px] font-bold text-error">{formErr}</p>
                )}
                <button
                  onClick={() => void placeOrder()}
                  disabled={placing}
                  className="w-full btn btn-primary border-2 border-black font-black text-xs uppercase py-2.5 btn-comic-interactive disabled:opacity-50 flex items-center justify-center gap-2 leading-none"
                >
                  <span>{placing ? t.products.processing : (effMethod === 'manual' ? t.products.confirmPlace : t.products.confirmGo)}</span>
                  {!placing && effMethod === 'sumopod' && <img src="/QRIS_logo.svg" alt="QRIS" className="h-3 w-auto" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </Layout>
  )
}
