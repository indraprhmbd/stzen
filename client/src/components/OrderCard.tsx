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
      return { label: 'PENDING', className: 'bg-warning text-neutral' }
    case 'PAID':
      return { label: 'PAID', className: 'bg-info text-neutral' }
    case 'DELIVERED':
      return { label: 'DELIVERED', className: 'bg-success text-neutral' }
    case 'REJECTED':
      return { label: 'REJECTED', className: 'bg-error text-neutral' }
    case 'REFUNDED':
      return { label: 'REFUNDED', className: 'bg-base-300 text-neutral' }
    default:
      return { label: status, className: 'bg-base-300 text-neutral' }
  }
}

export default function OrderCard({ order, onViewCredentials, onReport }: OrderCardProps) {
  const brand = useBrand()
  const statusConfig = getStatusConfig(order.status)

  return (
    <div className="bg-base-200 border-[3px] border-neutral shadow-brutal p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3
            className="font-black text-lg uppercase tracking-tight text-neutral"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {order.productName}
          </h3>
          {order.productCategory && (
            <p className="text-xs font-bold text-neutral/60 uppercase mt-0.5">
              {order.productCategory}
            </p>
          )}
        </div>
        <span className={`badge border-[2px] border-neutral font-bold text-[10px] ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Details */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs font-bold text-neutral/70">
        <span className="font-mono text-neutral">
          {brand.storefront.currencySymbol}{order.amount}
        </span>
        <span className="font-mono">
          {new Date(order.createdAt).toLocaleDateString()}
        </span>
        <span className="font-mono text-neutral/40">
          #{order.id.slice(0, 8)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {order.status === 'DELIVERED' && onViewCredentials && (
          <button
            className="bg-primary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral px-4 py-2"
            onClick={onViewCredentials}
          >
            VIEW CREDENTIALS
          </button>
        )}
        {onReport && (
          <button
            className="bg-secondary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral px-4 py-2"
            onClick={onReport}
          >
            REPORT ISSUE
          </button>
        )}
      </div>
    </div>
  )
}
