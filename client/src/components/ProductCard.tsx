import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

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

interface ProductCardProps {
  product: Product
  index?: number
  onBuy: () => void
  view?: 'grid' | 'list'
}

const categoryAccent: Record<string, string> = {
  streaming: 'bg-secondary',
  'ai tools': 'bg-primary-container',
  productivity: 'bg-tertiary-container',
}

function getStockConfig(count: number, t: ReturnType<typeof useCopy>['t']) {
  if (count === 0) return { label: t.products.outOfStock, color: 'text-error', dot: 'bg-error', icon: '' }
  if (count <= 3) return { label: `${count} LEFT`, color: 'text-warning', dot: 'bg-warning', icon: '⚡' }
  return { label: t.products.inStock, color: 'text-success', dot: 'bg-success', icon: '' }
}

export default function ProductCard({ product, index = 0, onBuy, view = 'grid' }: ProductCardProps) {
  const brand = useBrand()
  const { t } = useCopy()
  const stock = getStockConfig(product.stockCount, t)
  const inStock = product.stockCount > 0
  const featured = product.badge !== null
  const accent = categoryAccent[product.category.toLowerCase()] || 'bg-surface-container-high'

  if (view === 'list') {
    return (
      <div
        className="col-span-1 bg-white border-[3px] border-on-surface rounded-md shadow-brutal relative overflow-hidden group hover:-translate-y-0.5 hover:shadow-3d-subtle transition-all duration-200"
      >
        <div className="flex items-center gap-4 p-3">
          {/* Left: Category + Stock */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="bg-surface-container-high border border-on-surface/20 font-bold px-2 py-0.5 text-[8px] uppercase text-on-surface-variant rounded-sm">
              {product.category}
            </span>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${stock.dot}`} />
              <span className={`text-[8px] font-bold ${stock.color}`}>{stock.icon} {stock.label}</span>
            </div>
          </div>
          {/* Middle: Name + Desc */}
          <div className="flex-1 min-w-0">
            <h3
              className="font-extrabold text-xs uppercase tracking-tight text-on-surface leading-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {product.name}
            </h3>
            {product.description && (
              <p
                className="text-[9px] font-semibold text-on-surface-variant line-clamp-1 mt-0.5"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {product.description}
              </p>
            )}
          </div>
          {/* Right: Price + CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-extrabold text-sm text-on-surface" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {brand.storefront.currencySymbol}{product.price}
            </span>
            <button
              className={`
                border-[2px] border-on-surface font-extrabold text-[9px] uppercase px-3 py-1.5
                btn-brutal-interactive shadow-brutal-sm rounded-sm
                ${inStock
                  ? 'bg-primary-container text-on-surface'
                  : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                }
              `}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              disabled={!inStock}
              onClick={onBuy}
            >
              {inStock ? t.products.buy : t.products.soldOut}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Grid view — featured or standard
  return (
    <div
      className={`
        ${featured ? 'col-span-2' : 'col-span-1'}
        bg-white border-[3px] border-on-surface rounded-md shadow-brutal
        relative overflow-hidden group
        hover:-translate-y-1 hover:shadow-3d-subtle
        transition-all duration-200 flex flex-col
      `}
    >
      {/* Featured accent bar */}
      {featured && <div className={`h-1.5 ${accent}`} />}

      <div className={`${featured ? 'p-4' : 'p-2.5'} flex flex-col h-full`}>
        {/* Meta row */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="bg-surface-container-high border border-on-surface/20 font-bold px-1.5 py-0.5 text-[8px] uppercase text-on-surface-variant rounded-sm">
            {product.category}
          </span>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${stock.dot}`} />
            <span className={`text-[8px] font-bold ${stock.color}`}>{stock.icon} {stock.label}</span>
          </div>
        </div>

        {/* Badge pill */}
        {featured && product.badge && (
          <span className="inline-flex items-center gap-1 bg-on-surface text-primary-container font-black text-[8px] uppercase px-2 py-0.5 rounded-sm w-fit mb-1.5 tracking-wide">
            <span className="material-symbols-outlined text-[10px]">star</span>
            {product.badge}
          </span>
        )}

        {/* Title */}
        <h3
          className={`font-extrabold uppercase tracking-tight text-on-surface mb-0.5 leading-tight ${featured ? 'text-sm' : 'text-xs'}`}
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {product.name}
        </h3>

        {/* Description */}
        {product.description && (
          <p
            className={`text-[9px] font-semibold text-on-surface-variant mb-2 ${featured ? 'line-clamp-2' : 'line-clamp-1'}`}
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {product.description}
          </p>
        )}

        {/* Price + CTA */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t-[2px] border-on-surface/10">
          <span className={`font-extrabold text-on-surface ${featured ? 'text-lg' : 'text-sm'}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {brand.storefront.currencySymbol}{product.price}
          </span>
          <button
            className={`
              border-[2px] border-on-surface font-extrabold uppercase
              btn-brutal-interactive shadow-brutal-sm rounded-sm
              ${featured ? 'text-xs px-4 py-1.5' : 'text-[9px] px-2.5 py-1'}
              ${inStock
                ? 'bg-primary-container text-on-surface'
                : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
              }
            `}
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            disabled={!inStock}
            onClick={onBuy}
          >
            {inStock ? t.products.buy : t.products.soldOut}
          </button>
        </div>
      </div>
    </div>
  )
}
