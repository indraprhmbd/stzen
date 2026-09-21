import { memo, useState } from 'react'
import { Copy, Check, Xmark, Notes, WarningTriangle } from 'iconoir-react'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'
import { formatIdNumber } from '../lib/format'

interface Order {
  id: string
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
  amount: string
  createdAt: string
  productName: string
  productCategory?: string
  paymentProvider?: string | null
}

interface OrderCardProps {
  order: Order
  /** QRIS fee, display-only (buyer-paid on top of base). 0/undefined = base only. */
  fee?: number
  onViewCredentials?: (id: string) => void
  onReport?: (id: string) => void
  onReceipt?: (id: string) => void
  onPay?: (id: string) => void
  onContactWa?: (id: string) => void
  paying?: boolean
  onCancel?: (id: string) => void
}

function formatIdDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = months[d.getMonth()]
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd} ${mon} ${yyyy} ${hh}:${mm}`
}

function getStatusConfig(status: Order['status']) {
  // Solid high-contrast fills, black text on brights (white-on-warning was
  // unreadable). Brutal chip, not a daisy pill - see the badge markup below.
  switch (status) {
    case 'PENDING':
      return { label: 'PENDING', className: 'bg-warning text-black' }
    case 'PAID':
      return { label: 'PAID', className: 'bg-info text-black' }
    case 'DELIVERED':
      return { label: 'DELIVERED', className: 'bg-primary text-black' }
    case 'REJECTED':
      return { label: 'REJECTED', className: 'bg-error text-white' }
    case 'REFUNDED':
      return { label: 'REFUNDED', className: 'bg-neutral text-white' }
    default:
      return { label: status, className: 'bg-neutral text-white' }
  }
}

function OrderCard({ order, fee, onViewCredentials, onReport, onReceipt, onPay, onContactWa, paying, onCancel }: OrderCardProps) {
  const brand = useBrand()
  const { t, lang } = useCopy()
  const statusConfig = getStatusConfig(order.status)
  const locale = lang === 'id' ? 'id-ID' : 'en-US'
  const amount = formatIdNumber(order.amount, locale)
  const showFee = (fee ?? 0) > 0
  const total = formatIdNumber(Number(order.amount) + (fee ?? 0), locale)
  const [copied, setCopied] = useState(false)

  function copyId() {
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    // clipboard API needs secure context (missing on mobile LAN-IP);
    // fall back to execCommand so the tap always does something.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(order.id).then(done, () => {})
      return
    }
    try {
      const ta = document.createElement('textarea')
      ta.value = order.id
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      done()
    } catch {
      /* noop */
    }
  }

  return (
    <div className="bg-white border-comic shadow-comic flex flex-col p-2.5 min-w-0" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 180px' }}>
      {/* Title */}
      <h3
        className="font-black text-xs uppercase tracking-tight text-black leading-tight line-clamp-2 min-h-8"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {order.productName}
      </h3>
      {/* Pills */}
      <div className="flex flex-wrap items-center gap-1 mt-1 mb-1 max-h-9 overflow-hidden">
        <span className={`w-fit rounded-full border border-black text-[7px] uppercase px-1.5 py-px tracking-wide ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
        {order.paymentProvider && (
          <span className="w-fit rounded-full border border-black text-black text-[7px] uppercase px-1.5 py-px tracking-wide">
            {order.paymentProvider === 'sumopod' ? 'QRIS' : order.paymentProvider}
          </span>
        )}
      </div>
      {/* Meta */}
      <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-500 min-w-0">
        <span className="truncate">{formatIdDate(order.createdAt)}</span>
        <button
          onClick={copyId}
          title="Salin ID pesanan"
          className="shrink-0 inline-flex items-center gap-0.5 -m-1 p-1 hover:text-black"
        >
          #{order.id.slice(0, 8).toUpperCase()}
          {copied ? <Check width={10} height={10} strokeWidth={2.5} /> : <Copy width={10} height={10} strokeWidth={2} />}
        </button>
      </div>

      {/* Price */}
      <div className="mt-auto pt-2 flex items-end justify-between gap-1">
        <span className="font-black text-lg text-black whitespace-nowrap" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {brand.storefront.currencySymbol}{showFee ? total : amount}
        </span>
      </div>

      {/* Primary CTA: full-width */}
      {order.status === 'PENDING' && order.paymentProvider === 'manual' && onContactWa && (
        <button
          className="mt-1.5 w-full border-2 border-black font-black text-[10px] uppercase px-2.5 py-2 bg-primary text-black btn-comic-interactive"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          onClick={() => onContactWa?.(order.id)}
        >
          {t.dashboard.contactWa}
        </button>
      )}
      {order.status === 'PENDING' && order.paymentProvider !== 'manual' && onPay && (
        <button
          className="mt-1.5 w-full border-2 border-black font-black text-[10px] uppercase px-2.5 py-2 bg-primary text-black btn-comic-interactive disabled:opacity-50"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          onClick={() => onPay?.(order.id)}
          disabled={paying}
        >
          {paying ? '…' : t.dashboard.payNow}
        </button>
      )}
      {order.status === 'DELIVERED' && onViewCredentials && (
        <button
          className="mt-1.5 w-full border-2 border-black font-black text-[10px] uppercase px-2.5 py-1 bg-primary text-black btn-comic-interactive"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          onClick={() => onViewCredentials?.(order.id)}
        >
          {t.dashboard.viewCredentials}
        </button>
      )}

      {/* Secondary actions: single line, struk right */}
      <div className="flex items-center gap-1 mt-1.5 flex-nowrap">
        {order.status === 'PENDING' && onCancel && (
          <button
            className="inline-flex items-center gap-0.5 border border-black bg-white text-black font-bold uppercase text-[8px] px-1 py-0.5 whitespace-nowrap"
            onClick={() => onCancel?.(order.id)}
          >
            <Xmark width={10} height={10} strokeWidth={2.5} />{t.dashboard.cancelOrder}
          </button>
        )}
        {onReport && (
          <button
            className="inline-flex items-center gap-0.5 border border-black bg-error text-white font-bold uppercase text-[8px] px-1 py-0.5 whitespace-nowrap transition-colors hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px]"
            onClick={() => onReport?.(order.id)}
          >
            <WarningTriangle width={10} height={10} strokeWidth={2} />{t.dashboard.reportIssue}
          </button>
        )}
        {onReceipt && (
          <button
            className="ml-auto inline-flex items-center gap-0.5 border border-black bg-white text-black font-bold uppercase text-[8px] px-1 py-0.5 whitespace-nowrap transition-colors hover:bg-black hover:text-white"
            onClick={() => onReceipt?.(order.id)}
          >
            <Notes width={10} height={10} strokeWidth={2} />{t.dashboard.receipt}
          </button>
        )}
      </div>
    </div>
  )
}

export default memo(OrderCard)
