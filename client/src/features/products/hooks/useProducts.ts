import { useState, useEffect, useCallback, useMemo } from 'react'
import { authedApiRequest } from '../../../lib/api'
import type { Product, Variant } from '../types'

// Moved as-is from pages/admin/Products.tsx: fetch state + catalog load.
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const fetchAll = useCallback(async () => {
    setError(null); setLoading(true)
    try {
      // Single waterfall: both responses parse concurrently, not serially.
      const [resP, resV] = await Promise.all([
        authedApiRequest((c) => c.api.v1.admin.products.$get()),
        authedApiRequest((c) => c.api.v1.admin.variants.$get()),
      ])
      const [dataP, dataV] = await Promise.all([
        resP.json() as Promise<Product[]>,
        resV.json() as Promise<Variant[]>,
      ])
      setProducts(dataP)
      setVariants(dataV)
      setFetchedAt(Date.now())
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Gagal memuat'; setError(msg); showToast(msg, 'error') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products])

  return { products, variants, loading, error, fetchedAt, toast, fetchAll, showToast, categories }
}
