import { useBrand } from '../hooks/useBrand'

interface Product {
  id: string
  name: string
  description: string | null
  category: string
  price: string
  badge: string | null
  isActive: boolean
  stockCount: number
}

interface ProductModalProps {
  product: Product
  purchasing: boolean
  onClose: () => void
  onConfirm: () => void
}

function getStockConfig(count: number) {
  if (count === 0) return { label: 'Out of Stock', color: 'text-error', dot: 'bg-error' }
  if (count <= 3) return { label: `Only ${count} left`, color: 'text-warning', dot: 'bg-warning' }
  return { label: 'In Stock', color: 'text-success', dot: 'bg-success' }
}

export default function ProductModal({ product, purchasing, onClose, onConfirm }: ProductModalProps) {
  const brand = useBrand()
  const stock = getStockConfig(product.stockCount)
  const inStock = product.stockCount > 0

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg bg-white border-[3px] border-panel-dark shadow-3d-pop rounded-md p-0 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-2 bg-primary-container" />

        <div className="p-5 md:p-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="bg-surface-container-high border border-panel-dark/20 font-bold px-2 py-0.5 text-[10px] uppercase text-on-surface-variant">
                {product.category}
              </span>
              {product.badge && (
                <span className="bg-primary-container text-black font-bold px-2 py-0.5 text-[10px] uppercase">
                  {product.badge}
                </span>
              )}
            </div>
            <button
              className="border-2 border-panel-dark bg-white p-1 leading-none hover:bg-surface-container transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-on-surface" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>

          {/* Title */}
          <h2
            className="font-black text-2xl uppercase tracking-tight text-on-surface mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {product.name}
          </h2>

          {/* Stock */}
          <div className="flex items-center gap-1.5 mb-4">
            <div className={`w-2 h-2 rounded-full ${stock.dot}`} />
            <span className={`text-xs font-bold ${stock.color}`}>{stock.label}</span>
            {inStock && (
              <span className="text-xs font-bold text-on-surface-variant">· {product.stockCount} available</span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p
              className="text-sm font-bold text-on-surface-variant mb-5"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {product.description}
            </p>
          )}

          {/* How it works */}
          <div className="bg-surface-container border-2 border-panel-dark/20 p-4 mb-5">
            <p
              className="text-[10px] font-black uppercase text-on-surface-variant mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              How it works
            </p>
            <ol className="text-xs font-bold text-on-surface-variant space-y-1 list-decimal list-inside">
              <li>Place order</li>
              <li>Transfer payment via bank</li>
              <li>Admin approves payment</li>
              <li>Credentials delivered to your dashboard</li>
            </ol>
          </div>

          {/* Price + Confirm */}
          <div className="flex items-end justify-between gap-4 pt-4 border-t-[3px] border-panel-dark">
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-0.5">Total</p>
              <span className="font-black text-3xl text-on-surface" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {brand.storefront.currencySymbol}{product.price}
              </span>
            </div>
            <button
              className={`
                border-[3px] border-panel-dark font-black text-sm uppercase px-6 py-3
                btn-brutal-interactive shadow-brutal whitespace-nowrap
                ${inStock
                  ? 'bg-primary-container text-on-surface'
                  : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                }
              `}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              disabled={!inStock || purchasing}
              onClick={onConfirm}
            >
              {purchasing ? 'Processing...' : inStock ? 'Confirm Order' : 'Sold Out'}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </div>
  )
}
