import { useState, useEffect, useRef, useCallback } from 'react'
import { authedApiRequest } from '../../../lib/api'
import type { Variant } from '../types'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── VaultManager hook ──────────────────────────────────────────────────────
// Drives the entire Stok tab: unlock gate, variant picker, paginated
// credential list with per-row actions. One hook, one component, no split
// across StockPanel/VaultList/useStockImport.

interface VaultItem {
  id: string
  status: string
  createdAt: string
  allocatedAt: string | null
  credential: string
  orderPublicId: string | null
  orderStatus: string | null
}

interface VaultListResponse {
  items: VaultItem[]
  page: number
  hasMore: boolean
  total: number
  counts: Record<string, number>
}

export function useVaultManager(variants: Variant[]) {
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number>(0)
  const [variantId, setVariantId] = useState('')
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 300)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' })
  const [data, setData] = useState<VaultListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [rotateError, setRotateError] = useState<{ orderId: string; message: string } | null>(null)
  const fetchRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Auto relock countdown
  const [relockIn, setRelockIn] = useState(0)
  useEffect(() => {
    if (!token || !expiresAt) { setRelockIn(0); return }
    const tick = () => {
      const sec = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setRelockIn(sec)
      if (sec <= 0) { setToken(null); setExpiresAt(0); setData(null); return }
      timerRef.current = setTimeout(tick, 1000)
    }
    tick()
    return () => { clearTimeout(timerRef.current) }
  }, [token, expiresAt])

  async function unlock() {
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.vault.unlock.$post())
      const json = await res.json() as { token: string; expiresAt: number }
      setToken(json.token)
      setExpiresAt(json.expiresAt)
      showToast('Vault terbuka', 'success')
    } catch { showToast('Gagal membuka vault', 'error') }
  }

  function relock() {
    setToken(null); setExpiresAt(0); setData(null); setRelockIn(0)
    clearTimeout(timerRef.current)
    setToast({ msg: 'Vault terkunci', type: 'success' })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchList() {
    if (!token || !variantId) return
    setLoading(true); setError(null)
    try {
      const query: { variant: string; page?: number; q?: string; sort?: string; sortDir?: string } = { variant: variantId, page }
      if (debouncedQ) query.q = debouncedQ
      if (sort) { query.sort = sort.key; query.sortDir = sort.dir }
      const res = await authedApiRequest(
        (c) => c.api.v1.admin.vault.$get({ query }),
        { headers: { 'X-Vault-Token': token } }
      )
      setData(await res.json() as VaultListResponse)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat vault')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!token || !variantId) return
    const id = ++fetchRef.current
    fetchList().then(() => { if (id !== fetchRef.current) return })
  }, [token, variantId, page, debouncedQ, sort])

  // Re-lock on tab/page visibility hidden (soft: only if token present)
  useEffect(() => {
    function onVis() {
      if (document.hidden && token) { relock() }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [token])

  async function editCred(id: string, text: string) {
    setActionLoading(id)
    try {
      await authedApiRequest(
        (c) => c.api.v1.admin.vault[':id'].$put({ param: { id }, json: { credential: text } }),
        { headers: { 'X-Vault-Token': token! } }
      )
      showToast('Kredensial diperbarui', 'success')
      await fetchList()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Gagal update', 'error') }
    finally { setActionLoading(null) }
  }

  async function deleteCred(id: string) {
    setActionLoading(id)
    try {
      await authedApiRequest(
        (c) => c.api.v1.admin.vault[':id'].$delete({ param: { id } }),
        { headers: { 'X-Vault-Token': token! } }
      )
      showToast('Kredensial dihapus', 'success')
      await fetchList()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Gagal hapus', 'error') }
    finally { setActionLoading(null) }
  }

  async function revokeCred(id: string) {
    setActionLoading(id)
    try {
      await authedApiRequest(
        (c) => c.api.v1.admin.vault[':id'].revoke.$post({ param: { id } }),
        { headers: { 'X-Vault-Token': token! } }
      )
      showToast('Kredensial dicabut', 'success')
      await fetchList()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Gagal cabut', 'error') }
    finally { setActionLoading(null) }
  }

  async function rotateCred(orderId: string, opts?: { credential?: string; fallbackVariantId?: string }) {
    setActionLoading(orderId)
    setRotateError(null)
    try {
      await authedApiRequest(
        (c) => c.api.v1.admin.vault.replace[':orderId'].$post({ param: { orderId }, json: { credential: opts?.credential, fallbackVariantId: opts?.fallbackVariantId } })
      )
      showToast('Kredensial diganti', 'success')
      await fetchList()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal ganti'
      showToast(msg, 'error')
      setRotateError({ orderId, message: msg })
      throw e
    } finally { setActionLoading(null) }
  }

  function setVariantAndReset(id: string) {
    setVariantId(id); setPage(0); setQ(''); setData(null)
  }

  function toggleSort(key: string) {
    setPage(0)
    setSort((prev) => {
      if (prev.key === key) {
        if (prev.dir === 'asc') return { key, dir: 'desc' }
        return { key: 'createdAt', dir: 'desc' } // reset to default
      }
      return { key, dir: 'asc' }
    })
  }

  const isUnlocked = !!token && Date.now() < expiresAt
  const vaultOptions = variants
    .map((v) => ({ value: v.id, groupLabel: v.baseName, label: v.name, sublabel: `${v.sku} · ${v.fulfillmentType === 'on_demand' ? 'on demand' : `${v.stockCount} stok`}` }))

  return {
    // unlock
    isUnlocked, unlock, relock, relockIn, expiresAt,
    // variant
    variantId, setVariantId: setVariantAndReset, vaultOptions,
    // list
    data, loading, error, page, setPage, q, setQ,
    // actions
    actionLoading, editCred, deleteCred, revokeCred, rotateCred,
    fetchList, toast, showToast,
    sortKey: sort.key, sortDir: sort.dir, toggleSort,
    rotateError, setRotateError,
  }
}
