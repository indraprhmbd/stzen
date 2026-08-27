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
        <h1 className="text-4xl font-bold">{brand.name}</h1>
        <p className="text-lg text-base-content/70 mt-2">{brand.tagline}</p>
      </div>

      {/* Category Filter */}
      <div className="flex justify-center mb-6">
        <select
          className="select select-bordered w-full max-w-xs"
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
          <p className="text-base-content/50">No products available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title">
                  {product.name}
                  {product.badge && (
                    <div className="badge badge-secondary">{product.badge}</div>
                  )}
                </h2>
                {product.description && (
                  <p className="text-sm text-base-content/70">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl font-bold">
                    Rp {product.price}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`badge ${
                      product.stockCount > 0
                        ? 'badge-success'
                        : 'badge-error'
                    }`}
                  >
                    {product.stockCount > 0
                      ? `${product.stockCount} available`
                      : 'Out of stock'}
                  </div>
                  <div className="badge badge-outline">{product.category}</div>
                </div>
                <div className="card-actions justify-end mt-4">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={product.stockCount === 0}
                    onClick={() => handleBuyNow(product.id)}
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Catalog
