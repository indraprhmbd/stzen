import { useBrand } from '../hooks/useBrand'

interface Order {
  id: string
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
  amount: string
  createdAt: string
  productName: string
  productCategory?: string
}

interface OrderCardProps {
  order: Order
  onViewCredentials?: () => void
  onReport?: () => void
}

function getStatusConfig(status: Order['status']) {
  switch (status) {
    case 'PENDING':
      return { label: 'PENDING', className: 'bg-warning text-white', dot: 'bg-warning' }
    case 'PAID':
      return { label: 'PAID', className: 'bg-info text-white', dot: 'bg-info' }
    case 'DELIVERED':
      return { label: 'DELIVERED', className: 'bg-primary-container text-black', dot: 'bg-primary-container' }
    case 'REJECTED':
      return { label: 'REJECTED', className: 'bg-error text-white', dot: 'bg-error' }
    case 'REFUNDED':
      return { label: 'REFUNDED', className: 'bg-surface-container-highest text-on-surface', dot: 'bg-surface-container-highest' }
    default:
      return { label: status, className: 'bg-surface-container-highest text-on-surface', dot: 'bg-surface-container-highest' }
  }
}

export default function OrderCard({ order, onViewCredentials, onReport }: OrderCardProps) {
  const brand = useBrand()
  const statusConfig = getStatusConfig(order.status)

  return (
    <div className="bg-surface-container border-[3px] border-on-surface shadow-brutal p-5">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3
            className="font-black text-base uppercase tracking-tight text-on-surface"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {order.productName}
          </h3>
          {order.productCategory && (
            <span className="inline-block bg-on-surface text-primary-container font-mono font-bold text-[10px] uppercase px-1.5 py-0.5 mt-1">
              {order.productCategory}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          <span className={`badge border-[2px] border-on-surface font-bold text-[10px] ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-xs font-bold text-on-surface-variant">
        <span className="bg-surface-container-high px-2 py-0.5 font-mono text-on-surface border border-on-surface/20">
          {brand.storefront.currencySymbol}{order.amount}
        </span>
        <span className="font-mono">
          {new Date(order.createdAt).toLocaleDateString()}
        </span>
        <span className="font-mono text-on-surface-variant/40 text-[10px]">
          #{order.id.slice(0, 8)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {order.status === 'DELIVERED' && onViewCredentials && (
          <button
            className="bg-primary-container text-black border-[3px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[11px] px-3 py-1.5"
            onClick={onViewCredentials}
          >
            VIEW CREDENTIALS
          </button>
        )}
        {onReport && (
          <button
            className="bg-secondary-container text-black border-[3px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[11px] px-3 py-1.5"
            onClick={onReport}
          >
            REPORT ISSUE
          </button>
        )}
      </div>
    </div>
  )
}
