import { memo } from 'react'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

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
  onViewCredentials?: () => void
  onReport?: () => void
  onReceipt?: () => void
  onPay?: () => void
  onContactWa?: () => void
  paying?: boolean
  onCancel?: () => void
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
      return { label: 'REFUNDED', className: 'bg-neutral text-primary' }
    default:
      return { label: status, className: 'bg-neutral text-primary' }
  }
}

function OrderCard({ order, onViewCredentials, onReport, onReceipt, onPay, onContactWa, paying, onCancel }: OrderCardProps) {
  const brand = useBrand()
  const { t, lang } = useCopy()
  const statusConfig = getStatusConfig(order.status)
  const amount = Number(order.amount).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')

  return (
    <div className="bg-white border-[3px] border-black shadow-brutal-sm p-3" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 120px' }}>
      {/* Row 1: status + name + amount */}
      <div className="flex items-center gap-2">
        <span className={`shrink-0 border-2 border-black font-black text-[10px] uppercase px-1.5 py-px ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
        <h3
          className="flex-1 min-w-0 truncate font-black text-sm uppercase tracking-tight text-black"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {order.productName}
        </h3>
        <span className="shrink-0 font-mono font-black text-xs text-black">
          {brand.storefront.currencySymbol}{amount}
        </span>
      </div>

      {/* Row 2: meta + actions */}
      <div className="flex items-center gap-2 mt-2">
        <span className="font-mono text-[10px] text-zinc-500 truncate">
          {formatIdDate(order.createdAt)} · #{order.id.slice(0, 8).toUpperCase()}
        </span>
        <div className="ml-auto flex shrink-0 gap-1.5">
          {order.status === 'PENDING' && order.paymentProvider === 'manual' && onContactWa && (
            <button
              className="bg-primary text-black border-2 border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[10px] px-2 py-1"
              onClick={onContactWa}
            >
              {t.dashboard.contactWa}
            </button>
          )}
          {order.status === 'PENDING' && order.paymentProvider !== 'manual' && onPay && (
            <button
              className="bg-primary text-black border-2 border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[10px] px-2 py-1 disabled:opacity-50"
              onClick={onPay}
              disabled={paying}
            >
              {paying ? '…' : t.dashboard.payNow}
            </button>
          )}
          {order.status === 'DELIVERED' && onViewCredentials && (
            <button
              className="bg-primary text-black border-2 border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[10px] px-2 py-1"
              onClick={onViewCredentials}
            >
              {t.dashboard.viewCredentials}
            </button>
          )}
          {order.status === 'PENDING' && onCancel && (
            <button
              className="bg-white text-black border-2 border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[10px] px-2 py-1"
              onClick={onCancel}
            >
              {t.dashboard.cancelOrder}
            </button>
          )}
          {onReceipt && (
            <button
              className="bg-white text-black border-2 border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[10px] px-2 py-1"
              onClick={onReceipt}
            >
              {t.dashboard.receipt}
            </button>
          )}
          {onReport && (
            <button
              className="bg-error text-white border-2 border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[10px] px-2 py-1"
              onClick={onReport}
            >
              {t.dashboard.reportIssue}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(OrderCard)
