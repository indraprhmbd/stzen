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

interface ProductCardProps {
  product: Product
  featured?: boolean
  onBuy: () => void
}

function getStockBadge(stockCount: number) {
  if (stockCount === 0) {
    return { label: 'OUT OF STOCK', className: 'bg-error text-neutral' }
  }
  if (stockCount <= 3) {
    return { label: 'LOW STOCK', className: 'bg-accent text-neutral' }
  }
  return { label: 'INSTANT STOCK', className: 'bg-accent text-neutral' }
}

function getBadgeRotation(index: number) {
  const rotations = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2']
  return rotations[index % rotations.length]
}

export default function ProductCard({ product, featured = false, onBuy }: ProductCardProps) {
  const brand = useBrand()
  const stockBadge = getStockBadge(product.stockCount)

  return (
    <div
      className={`
        bg-base-200 border-[3px] border-neutral rounded-sm flex flex-col relative
        ${featured ? 'shadow-pop-pink -translate-y-2' : 'shadow-brutal'}
        transition-all hover:-translate-x-[2px] hover:-translate-y-[2px]
        group
      `}
    >
      {/* Featured ribbon */}
      {featured && (
        <div className="bg-secondary absolute top-3 -right-1 px-2 py-0.5 border-[2px] border-neutral -rotate-3">
          <span className="font-black text-[10px] uppercase text-neutral tracking-wider">HOT</span>
        </div>
      )}

      <div className="p-5 flex flex-col flex-grow">
        {/* Top: Badge + Price */}
        <div className="flex justify-between items-start mb-3">
          <span
            className={`
              badge font-bold border-[2px] border-neutral shadow-brutal-sm px-3 py-2 text-[10px] uppercase
              ${stockBadge.className}
              ${getBadgeRotation(product.name.length)}
            `}
          >
            {product.badge?.toUpperCase() || stockBadge.label}
          </span>
          <span
            className="font-black text-2xl text-primary text-stroke-thin"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {brand.storefront.currencySymbol}{product.price}
          </span>
        </div>

        {/* Middle: Name + Description */}
        <h3
          className="font-black text-lg uppercase tracking-tight text-neutral mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {product.name}
        </h3>
        {product.description && (
          <p
            className="text-xs font-bold text-neutral/70 mb-4 line-clamp-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {product.description}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Bottom: Stock + Category + Buy */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className={`
              badge border-[2px] border-neutral font-mono font-bold text-[10px]
              ${product.stockCount > 0 ? 'bg-success text-neutral' : 'bg-error text-neutral'}
            `}
          >
            {product.stockCount > 0 ? `${product.stockCount} IN STOCK` : 'EMPTY'}
          </div>
          <div className="badge border-[2px] border-neutral bg-base-300 text-neutral font-bold text-[10px] uppercase">
            {product.category}
          </div>
        </div>

        <button
          className={`
            w-full border-[3px] border-neutral shadow-brutal btn-brutal-interactive font-black uppercase text-sm
            ${product.stockCount > 0
              ? 'bg-primary text-neutral'
              : 'bg-base-300 text-neutral/40 cursor-not-allowed'
            }
          `}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          disabled={product.stockCount === 0}
          onClick={onBuy}
        >
          {product.stockCount > 0 ? 'BUY NOW' : 'SOLD OUT'}
        </button>
      </div>
    </div>
  )
}
