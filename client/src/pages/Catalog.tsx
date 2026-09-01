import { Fragment, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiV1, authedApiRequest } from '../lib/api'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'
import Layout from '../components/Layout'
import FilterBar from '../components/FilterBar'
import ProductCard from '../components/ProductCard'
import ProductModal from '../components/ProductModal'
import Marquee from '../components/Marquee'
import SkeletonCard from '../components/SkeletonCard'
import CopyToast from '../components/CopyToast'

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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [toastMsg, setToastMsg] = useState('')
  const brand = useBrand()
  const navigate = useNavigate()
  const { t } = useCopy()
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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

  // Filter + search + sort
  const filteredProducts = products
    .filter((p) => selectedCategory === 'all' || p.category === selectedCategory)
    .filter((p) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sort === 'price') return parseFloat(a.price) - parseFloat(b.price)
      if (sort === 'stock') return b.stockCount - a.stockCount
      return 0 // newest = default order from API
    })

  const handleConfirmOrder = async () => {
    if (!selectedProduct) return
    setPurchasing(true)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.checkout.$post({ json: { productId: selectedProduct.id } })
      )
      if (res.ok) {
        const data = await res.json() as any
        const oid = typeof data.orderId === 'string' ? data.orderId : data.orderId?.id ?? JSON.stringify(data.orderId)
        setToastMsg(`Order #${oid} dibuat!`)
        setSelectedProduct(null)
        fetchProducts()
      } else {
        const err = await res.json()
        alert((err as any).error || 'Checkout failed')
      }
    } catch {
      alert('Please sign in to checkout')
      navigate('/login')
    } finally {
      setPurchasing(false)
    }
  }

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setToastMsg(t.common.copiedToClipboard)
  }, [t])

  if (loading) {
    return (
      <Layout>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* ═══ HERO — Massive Display ═══ */}
      <section className="relative overflow-hidden border-b-[3px] border-on-surface mb-0">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage via-forest-green to-dark-sage bg-grid-dots" />
        {/* Logo — massive, overflowing the hero */}
        <img
          src="/logo.svg"
          alt=""
          aria-hidden="true"
          className="absolute -right-16 md:-right-8 -top-16 md:-top-12 w-[260px] md:w-[400px] h-auto opacity-[0.07] invert pointer-events-none select-none"
        />

        <div className="relative z-10 px-4 md:px-8 py-8 md:py-12">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 bg-black/40 border-[2px] border-primary-container/30 rounded-sm px-3 py-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
            <span
              className="font-black text-[9px] md:text-[10px] uppercase tracking-widest text-primary-container"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.hero.statusPill}
            </span>
          </div>

          {/* Giant title */}
          <h1
            className="rubik-mono-text text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white uppercase leading-[0.85] mb-6 max-w-3xl origin-left"
            style={{ transform: 'scaleX(1.08)', wordSpacing: '-0.575em', letterSpacing: '-0.06em' }}
          >
            {t.hero.title1}
            <span className="text-primary-container block mt-1">{t.hero.title2}</span>
          </h1>
        </div>
      </section>

      {/* ═══ MARQUEE TICKER ═══ */}
      <Marquee items={t.marquee} />

      {/* ═══ HOW IT WORKS — pipeline ═══ */}
      <section className="mb-8">
        <h2
          className="font-black text-base uppercase tracking-tighter text-on-surface mb-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t.howItWorks.title}
        </h2>
        {/* Desktop: horizontal pipeline */}
        <div className="hidden md:grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-0 items-start">
          {t.howItWorks.steps.map((step, i) => {
            const badgeColors = ['bg-secondary text-white', 'bg-primary-container text-black', 'bg-tertiary-container text-black', 'bg-dark-sage text-white']
            const borderColors = ['border-secondary', 'border-primary-container', 'border-tertiary-container', 'border-dark-sage']
            return (
              <Fragment key={step.num}>
                <div className={`border-[3px] ${borderColors[i]} rounded-md p-3 shadow-brutal-sm bg-on-surface`}>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${badgeColors[i]} border-2 border-white font-black text-sm shrink-0`}>
                      {step.num}
                    </span>
                    <div>
                      <h3
                        className="font-extrabold text-sm uppercase tracking-tight text-white leading-none"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        {step.title}
                      </h3>
                      <p
                        className="text-[10px] font-semibold text-inverse-on-surface/70 leading-snug mt-0.5"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </div>
                {i < 3 && (
                  <div className="flex items-center justify-center px-1 pt-6">
                    <span className="material-symbols-outlined text-white/30 text-xl">arrow_forward</span>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
        {/* Mobile: stacked */}
        <div className="md:hidden flex flex-col gap-0">
          {t.howItWorks.steps.map((step, i) => {
            const badgeColors = ['bg-secondary text-white', 'bg-primary-container text-black', 'bg-tertiary-container text-black', 'bg-dark-sage text-white']
            const borderColors = ['border-secondary', 'border-primary-container', 'border-tertiary-container', 'border-dark-sage']
            return (
              <Fragment key={step.num}>
                <div className={`flex items-start gap-3 border-[3px] ${borderColors[i]} rounded-md p-2.5 shadow-brutal-sm bg-on-surface`}>
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${badgeColors[i]} border-2 border-white font-black text-xs`}>
                    {step.num}
                  </span>
                  <div className="flex-1">
                    <h3
                      className="font-extrabold text-sm uppercase tracking-tight text-white leading-none"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="text-[10px] font-semibold text-inverse-on-surface/70 leading-snug mt-0.5"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>
                {i < 3 && (
                  <div className="flex justify-center py-1">
                    <span className="material-symbols-outlined text-white/30 text-base">arrow_downward</span>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </section>

      {/* ═══ CATALOG ═══ */}
      {/* Section Header */}
      <div className="mb-4">
        <h2
          className="font-black text-base uppercase tracking-tighter text-on-surface"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t.products.title}
          {searchQuery && (
            <span className="ml-2 text-sm text-on-surface-variant font-normal">
              — &ldquo;{searchQuery}&rdquo;
            </span>
          )}
        </h2>
      </div>

      {/* Sticky Filter Bar */}
      <FilterBar
        categories={categories}
        active={selectedCategory}
        onChange={setSelectedCategory}
        counts={categoryCounts}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchRef={searchRef}
      />

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-surface-container border-[3px] border-on-surface shadow-brutal p-8 rounded-md">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">inventory_2</span>
          <p className="text-on-surface-variant/50 font-bold">{t.common.noProducts}</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              view="grid"
              onBuy={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {filteredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              view="list"
              onBuy={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      )}

      {/* ═══ WHY ST.ZEN ═══ */}
      <section className="mt-10 mb-8 bg-on-surface border-[3px] border-on-surface rounded-md p-5 shadow-brutal-sm">
        <h2
          className="font-black text-base uppercase tracking-tighter text-white mb-5"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t.whyUs.title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: 'bolt', accent: 'bg-secondary', text: 'text-white', subtext: 'text-white/80', bar: 'bg-white/30', border: 'border-white/20' },
            { icon: 'lock', accent: 'bg-primary-container', text: 'text-black', subtext: 'text-black/70', bar: 'bg-black/20', border: 'border-black/15' },
            { icon: 'verified', accent: 'bg-tertiary-container', text: 'text-black', subtext: 'text-black/70', bar: 'bg-black/20', border: 'border-black/15' },
          ].map((cfg, i) => {
            const item = t.whyUs.items[i]
            return (
              <div
                key={item.title}
                className={`relative ${cfg.accent} rounded-md p-4 pl-5 border-2 ${cfg.border}`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${cfg.bar} rounded-l-md`} />
                <div className="flex items-start gap-3">
                  <span className={`material-symbols-outlined text-2xl ${cfg.text} shrink-0 mt-0.5`}>{cfg.icon}</span>
                  <div>
                    <h3
                      className={`font-extrabold text-sm uppercase tracking-tight ${cfg.text} mb-1`}
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {item.title}
                    </h3>
                    <p
                      className={`text-[10px] font-semibold ${cfg.subtext} leading-snug`}
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="mb-10">
        <h2
          className="font-black text-base uppercase tracking-tighter text-on-surface mb-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t.testimonials.title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {t.testimonials.items.map((item) => (
            <div
              key={item.name}
              className="bg-surface-container border-[3px] border-on-surface rounded-md p-4 shadow-brutal-sm"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="material-symbols-outlined text-xs text-warning">star</span>
                ))}
              </div>
              {/* Quote */}
              <p
                className="text-[10px] font-semibold text-on-surface leading-snug mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                &ldquo;{item.quote}&rdquo;
              </p>
              {/* Author + badge */}
              <div className="border-t-[2px] border-on-surface/10 pt-2 flex items-center justify-between">
                <div>
                  <p
                    className="font-extrabold text-[10px] uppercase text-on-surface"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {item.name}
                  </p>
                  <p className="text-[8px] font-bold text-on-surface-variant">{item.product}</p>
                </div>
                <span className="inline-flex items-center gap-0.5 bg-success/10 text-success font-black text-[7px] uppercase px-1.5 py-0.5 rounded-sm border border-success/20">
                  <span className="material-symbols-outlined text-[8px]">verified</span>
                  {t.products.verifiedBuyer}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PRODUCT MODAL ═══ */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          purchasing={purchasing}
          onClose={() => setSelectedProduct(null)}
          onConfirm={handleConfirmOrder}
        />
      )}

      {/* ═══ TOAST ═══ */}
      {toastMsg && <CopyToast message={toastMsg} onDone={() => setToastMsg('')} />}
    </Layout>
  )
}

export default Catalog
