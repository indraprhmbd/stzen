import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiV1 } from '../lib/api'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

type Product = {
  id: string
  name: string
  description: string | null
  category: string
  price: string
  stockCount: number
  fulfillmentType?: string
}

interface SearchOverlayProps {
  open: boolean
  onClose: () => void
}

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const navigate = useNavigate()
  const brand = useBrand()
  const { t } = useCopy()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setResults([])
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        // Plain object: hono/client drops URLSearchParams instances in query.
        const res = await apiV1.products.$get({ query: { search: query } })
        if (res.ok) {
          const data = await res.json()
          const products = Array.isArray(data) ? data : Array.isArray((data as any)?.products) ? (data as any).products : []
          setResults(products.slice(0, 8))
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback((id: string) => {
    onClose()
    navigate(`/products/${id}`)
  }, [onClose, navigate])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex flex-col" onClick={onClose}>
      {/* Search bar */}
      <div
        className="bg-white border-b-[3px] border-black px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="material-symbols-outlined text-black/40 text-lg">search</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={t.hero.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/[^\p{L}\p{N}\s\-_.,&']/gu, '').slice(0, 64))}
            className="flex-1 bg-transparent font-black text-sm uppercase text-black placeholder:text-black/30 focus:outline-none"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          />
          <button
            onClick={onClose}
            className="w-8 h-8 border-2 border-black bg-white text-black font-black text-xs flex items-center justify-center hover:bg-black hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Results */}
      <div
        className="flex-1 overflow-y-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-2xl mx-auto px-4 py-3">
          {loading && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg" />
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-8">
              <p className="font-black text-xs uppercase text-black/40" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Tidak ada hasil untuk "{query}"
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="flex flex-col gap-1">
              {results.map((product) => {
                const inStock = product.fulfillmentType === 'on_demand' || product.stockCount > 0
                return (
                  <button
                    key={product.id}
                    onClick={() => handleSelect(product.id)}
                    className="flex items-center gap-3 p-3 border-2 border-black/10 hover:border-black hover:bg-primary/10 transition-all text-left w-full"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-xs uppercase text-black truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {product.name}
                      </p>
                      <p className="text-[10px] font-bold text-black/40 uppercase">
                        {product.category}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-black text-sm text-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {brand.storefront.currencySymbol} {Number(product.price).toLocaleString('id-ID')}
                      </p>
                      <p className={`text-[9px] font-bold uppercase ${inStock ? 'text-green-600' : 'text-red-500'}`}>
                        {inStock ? t.products.inStock : t.products.outOfStock}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {query.length < 2 && (
            <div className="text-center py-8">
              <p className="font-black text-[10px] uppercase text-black/30" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Ketik minimal 2 karakter untuk mencari
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
