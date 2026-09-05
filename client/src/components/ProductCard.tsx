import { useState, useEffect } from 'react'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'
import { prefetchDetailChunk, prefetchDetailData } from '../lib/prefetch'

interface Product {
  id: string
  name: string
  description: string | null
  category: string
  price: string
  compareAtPrice?: number | null
  badge: string | null
  isActive: boolean
  stockCount: number
  fulfillmentType?: string
}

interface ProductCardProps {
  product: Product
  index?: number
  onBuy: () => void
  view?: 'grid' | 'list'
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

function discountPct(price: string | number, compare: number | null | undefined): number | null {
  const p = Number(price)
  const c = compare == null ? NaN : Number(compare)
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c <= p) return null
  return Math.round(((c - p) / c) * 100)
}

function badgeList(badge: string | null): string[] {
  if (!badge) return []
  return badge.split(';').map((b) => b.trim()).filter(Boolean)
}

export default function ProductCard({ product, index = 0, onBuy, view = 'grid' }: ProductCardProps) {
  // Warm the detail route ahead of the tap: chunk for every card, API data
  // for above-the-fold cards only (index < 4). Hover (desktop), touch-start
  // (mobile, fires before click), focus (keyboard via the buy button).
  function warmDetail() {
    prefetchDetailChunk()
    if (index < 4) prefetchDetailData(product.id)
  }
  const brand = useBrand()
  const { t } = useCopy()
  const isMobile = useIsMobile()
  const isOnDemand = product.fulfillmentType === 'on_demand'
  const inStock = isOnDemand || product.stockCount > 0
  const statusLabel = !inStock
    ? t.products.soldOut
    : isOnDemand
      ? 'On Demand'
      : product.stockCount <= 3
        ? `⚡ ${product.stockCount} LEFT`
        : t.products.inStock
  const pct = discountPct(product.price, product.compareAtPrice)

  // ═══ MOBILE: vertical card ═══
  if (isMobile) {
    return (
      <div
        className="bg-white border-comic shadow-comic relative overflow-hidden group flex flex-col"
        onClick={onBuy}
        onMouseEnter={warmDetail}
        onTouchStart={warmDetail}
      >
        {/* Content */}
        <div className="p-2.5 flex flex-col flex-1 min-w-0">
          {/* Title */}
          <h3
            className="font-black text-xs uppercase tracking-tight text-neutral leading-tight mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {product.name}
          </h3>
          {/* Pills */}
          <div className="flex flex-wrap gap-1 mb-1">
            <span className="w-fit rounded-full border border-black text-black text-[8px] uppercase px-2 py-0.5 tracking-wide">
              {product.category}
            </span>
            <span className="w-fit rounded-full border border-black text-black text-[8px] uppercase px-2 py-0.5 tracking-wide">
              {statusLabel}
            </span>
            {badgeList(product.badge).map((b) => (
              <span key={b} className="w-fit rounded-full border border-black text-black text-[8px] uppercase px-2 py-0.5 tracking-wide">
                {b}
              </span>
            ))}
          </div>

          {/* Price + CTA */}
          <div className="mt-auto pt-2 flex items-center justify-between">
            <div className="min-w-0">
              {pct !== null && (
                <div className="flex items-center gap-1">
                  <s className="text-[9px] font-bold text-neutral/50 whitespace-nowrap">
                    {brand.storefront.currencySymbol} {Number(product.compareAtPrice).toLocaleString('id-ID')}
                  </s>
                  <span className="rounded-full border border-black text-black text-[8px] px-1.5 py-0.5 whitespace-nowrap">
                    -{pct}%
                  </span>
                </div>
              )}
              <span
                className="font-black text-lg text-neutral"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {brand.storefront.currencySymbol} {Number(product.price).toLocaleString('id-ID')}
              </span>
            </div>
            <button
              className={`
                border-2 border-black font-black text-[9px] uppercase px-2.5 py-1.5 bg-primary text-black
                btn-comic-interactive
                ${!inStock ? 'opacity-40 cursor-not-allowed' : ''}
              `}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              disabled={!inStock}
              onClick={(e) => { e.stopPropagation(); onBuy() }}
              onFocus={warmDetail}
            >
              {inStock ? t.products.buy : t.products.soldOut}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══ DESKTOP: list view ═══
  if (view === 'list') {
    return (
      <div
      className="col-span-1 bg-white border-comic shadow-comic relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      onClick={onBuy}
      onMouseEnter={warmDetail}
      onTouchStart={warmDetail}
    >
        <div className="flex items-center gap-4 p-3">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="rounded-full border border-black text-black text-[7px] uppercase px-2 py-0.5 tracking-wide">
              {product.category}
            </span>
            <span className="rounded-full border border-black text-black text-[7px] uppercase px-2 py-0.5 tracking-wide">
              {statusLabel}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-xs uppercase tracking-tight text-on-surface leading-tight line-clamp-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {product.name}
            </h3>
            {badgeList(product.badge).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {badgeList(product.badge).map((b) => (
                  <span key={b} className="w-fit rounded-full border border-black text-black text-[8px] uppercase px-2 py-0.5 tracking-wide">
                    {b}
                  </span>
                ))}
              </div>
            )}
            {product.description && (
              <p className="text-[9px] font-semibold text-on-surface-variant line-clamp-1 mt-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {product.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
            <div className="min-w-0">
              {pct !== null && (
                <div className="flex items-center gap-1">
                  <s className="text-[10px] font-bold text-neutral/50 whitespace-nowrap">
                    {brand.storefront.currencySymbol} {Number(product.compareAtPrice).toLocaleString('id-ID')}
                  </s>
                  <span className="rounded-full border border-black text-black text-[8px] px-1.5 py-0.5 whitespace-nowrap">
                    -{pct}%
                  </span>
                </div>
              )}
              <span className="font-black text-xl text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {brand.storefront.currencySymbol} {Number(product.price).toLocaleString('id-ID')}
              </span>
            </div>
            <button
              className={`btn btn-primary border-comic shadow-comic btn-comic-interactive font-black uppercase text-[9px] px-3 py-1.5 ${!inStock ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              disabled={!inStock}
              onClick={(e) => { e.stopPropagation(); onBuy() }}
              onFocus={warmDetail}
            >
              {inStock ? t.products.buy : t.products.soldOut}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══ DESKTOP: grid view ═══
  return (
    <div
      className="
        col-span-1
        bg-white border-comic shadow-comic
        relative overflow-hidden group
        hover:-translate-y-1
        transition-all duration-200 flex flex-col cursor-pointer
      "
      onClick={onBuy}
      onMouseEnter={warmDetail}
      onTouchStart={warmDetail}
    >
      <div className="p-3 flex flex-col h-full">
        <h3 className="font-black uppercase tracking-tight text-neutral mb-1 leading-tight text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {product.name}
        </h3>
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="w-fit rounded-full border border-black text-black text-[10px] uppercase px-2 py-0.5 tracking-wide">
            {product.category}
          </span>
          <span className="w-fit rounded-full border border-black text-black text-[10px] uppercase px-2 py-0.5 tracking-wide">
            {statusLabel}
          </span>
          {badgeList(product.badge).map((b) => (
            <span key={b} className="w-fit rounded-full border border-black text-black text-[8px] uppercase px-2 py-0.5 tracking-wide">
              {b}
            </span>
          ))}
        </div>
        {product.description && (
          <p className="text-xs font-bold text-neutral/80 mb-4 line-clamp-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {product.description}
          </p>
        )}
        <div className="mt-auto pt-3 flex justify-between items-center">
          <div className="min-w-0">
            {pct !== null && (
              <div className="flex items-center gap-1.5">
                <s className="text-xs font-bold text-neutral/50 whitespace-nowrap">
                  {brand.storefront.currencySymbol} {Number(product.compareAtPrice).toLocaleString('id-ID')}
                </s>
                <span className="rounded-full border border-black text-black text-[10px] px-2 py-0.5 whitespace-nowrap">
                  -{pct}%
                </span>
              </div>
            )}
            <span className="font-black text-neutral text-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {brand.storefront.currencySymbol} {Number(product.price).toLocaleString('id-ID')}
            </span>
          </div>
          <button
            className={`btn btn-primary border-comic shadow-comic btn-comic-interactive font-black uppercase text-xs px-3 py-1 ${!inStock ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            disabled={!inStock}
            onClick={(e) => { e.stopPropagation(); onBuy() }}
          >
            {inStock ? t.products.buy : t.products.soldOut}
          </button>
        </div>
      </div>
    </div>
  )
}
