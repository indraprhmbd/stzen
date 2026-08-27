import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiV1 } from '../lib/api'
import { useBrand } from '../hooks/useBrand'
import Layout from '../components/Layout'
import FilterBar from '../components/FilterBar'
import ProductCard from '../components/ProductCard'

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
  const brand = useBrand()
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

  const categoryCounts: Record<string, number> = { all: products.length }
  products.forEach((p) => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1
  })

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
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
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
      <FilterBar
        categories={categories}
        active={selectedCategory}
        onChange={setSelectedCategory}
        counts={categoryCounts}
      />

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral/50 font-bold">No products available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              featured={index === 0 && product.stockCount > 5}
              onBuy={() => handleBuyNow(product.id)}
            />
          ))}
        </div>
      )}
    </Layout>
  )
}

export default Catalog
