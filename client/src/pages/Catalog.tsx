import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiV1 } from '../lib/api'
import { useBrand } from '../hooks/useBrand'

type Product = {
  id: string
  name: string
  description: string | null
  category: string
  price: string
  badge: string | null
  isActive: boolean
  stockCount: number
}

function Catalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const { brand } = useBrand()
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await apiV1.products.$get()
      const data = await res.json()
      setProducts(data as Product[])
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const categories = ['all', ...new Set(products.map((p) => p.category))]

  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter((p) => p.category === selectedCategory)

  const handleBuyNow = async (productId: string) => {
    try {
      const res = await apiV1.checkout.$post({ json: { productId } })
      if (res.ok) {
        const data = await res.json()
        alert(`Order created! Order ID: ${(data as any).orderId}. Please transfer and wait for admin approval.`)
      } else {
        const err = await res.json()
        alert((err as any).error || 'Checkout failed')
      }
    } catch {
      alert('Please sign in to checkout')
      navigate('/login')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1
          className="text-5xl font-black uppercase tracking-tight text-neutral"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {brand.name}
        </h1>
        <p
          className="text-lg font-bold text-neutral/80 mt-2"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {brand.tagline}
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex justify-center mb-6">
        <select
          className="select select-bordered w-full max-w-xs border-brutal font-bold text-neutral shadow-brutal-sm rounded-sm"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral/50 font-bold">No products available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="card bg-base-200 border-brutal-thick shadow-pop-pink rounded-md p-5 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                {product.badge ? (
                  <span className="badge bg-accent text-neutral font-black border-brutal -rotate-2 shadow-brutal-sm px-3 py-2 text-xs">
                    {product.badge.toUpperCase()}
                  </span>
                ) : (
                  <span className="badge bg-accent text-neutral font-black border-brutal -rotate-2 shadow-brutal-sm px-3 py-2 text-xs">
                    {brand.storefront.badgeTextDefault.toUpperCase()}
                  </span>
                )}
                <span
                  className="font-black text-2xl text-primary text-stroke-thin"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {brand.storefront.currencySymbol}{product.price}
                </span>
              </div>
              <h3
                className="font-black text-xl uppercase tracking-tight text-neutral mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {product.name}
              </h3>
              {product.description && (
                <p
                  className="text-xs font-bold text-neutral/80 mb-4"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {product.description}
                </p>
              )}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className={`badge border-brutal font-mono font-bold text-xs ${
                    product.stockCount > 0
                      ? 'bg-success text-neutral'
                      : 'bg-error text-neutral'
                  }`}
                >
                  {product.stockCount > 0
                    ? `${product.stockCount} AVAILABLE`
                    : 'OUT OF STOCK'}
                </div>
                <div className="badge border-brutal bg-base-300 text-neutral font-bold text-xs">
                  {product.category.toUpperCase()}
                </div>
              </div>
              <button
                className="btn btn-primary w-full border-brutal shadow-brutal btn-brutal-interactive font-black uppercase"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                disabled={product.stockCount === 0}
                onClick={() => handleBuyNow(product.id)}
              >
                Get Credentials
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Catalog
