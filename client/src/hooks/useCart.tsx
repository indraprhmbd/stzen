import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { hc } from 'hono/client'
import type { AppType } from '../../../server/app'
import { supabase } from '../lib/supabase'

// ─── Cart Store (server-authoritative) ──────────────────────────────────────
// Single source: GET /api/v1/cart. Local state is a display cache replaced
// wholesale by every server response. Writes are desired-state PUTs carrying
// the last-seen version; 409 means another tab/device won - refetch, surface
// conflict, never silently overwrite.
// Guest session rides the HttpOnly cart_token cookie (credentials:include).
// Logged-in requests add the Supabase bearer; login triggers POST /merge so
// the pre-login guest cart folds into the user cart exactly once.

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export interface CartLine {
  variantPublicId: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  compareAtPrice: number | null
}

export interface CartView {
  cartId: string | null
  version: number
  items: CartLine[]
  subtotal: number
  itemCount: number
}

const EMPTY: CartView = { cartId: null, version: 0, items: [], subtotal: 0, itemCount: 0 }

interface CartContextValue extends CartView {
  loading: boolean
  conflict: boolean
  refresh: () => Promise<CartView | null>
  setQuantity: (variantPublicId: string, quantity: number) => Promise<void>
  removeLine: (variantPublicId: string) => Promise<void>
  clear: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

type CartClient = ReturnType<typeof hc<AppType>>['api']['v1']['cart']

async function cartClient(): Promise<CartClient> {
  return hc<AppType>(API_BASE, {
    headers: await authHeaders(),
    credentials: 'include',
  } as never).api.v1.cart
}

function toView(data: unknown): CartView {
  const d = data as CartView
  return {
    cartId: d.cartId ?? null,
    version: d.version ?? 0,
    items: Array.isArray(d.items) ? d.items : [],
    subtotal: d.subtotal ?? 0,
    itemCount: d.itemCount ?? 0,
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<CartView>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [conflict, setConflict] = useState(false)
  // Stale-response guard: focus refetch racing an in-flight mutation must
  // not paint older state over newer. Only the latest generation commits.
  const generation = useRef(0)

  const refresh = useCallback(async (): Promise<CartView | null> => {
    const gen = ++generation.current
    try {
      const client = await cartClient()
      const res = await client.$get()
      if (generation.current !== gen) return null
      if (res.ok) {
        const next = toView(await res.json())
        setView(next)
        setConflict(false)
        return next
      }
      return null
    } catch {
      // Offline / gateway down: keep last-known view, page shows stale UI.
      return null
    } finally {
      if (generation.current === gen) setLoading(false)
    }
  }, [])

  // Refetch on mount, window focus, tab visibility, and login change (merge
  // folds the guest cart server-side first so the refresh shows the union).
  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (!active) return
      if (event === 'SIGNED_IN') {
        try {
          const client = await cartClient()
          await client.merge.$post()
        } catch {
          // No guest cart to fold (or merge raced): refresh shows truth.
        }
      }
      refresh()
    })
    refresh()
    const onFocus = () => refresh()
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      active = false
      subscription.unsubscribe()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refresh])

  // Version-gated mutation with ONE automatic retry on VERSION_CONFLICT:
  // PUTs are desired-state (idempotent), so resending against the fresh
  // version is safe. CHECKOUT_IN_PROGRESS and second-conflict surface to UI.
  const mutate = useCallback(async (
    fn: (c: CartClient, version: number) => Promise<Response>,
    fallback: CartView,
  ) => {
    setConflict(false)
    const gen = ++generation.current
    const client = await cartClient()
    const send = async (version: number): Promise<Response | null> => {
      try {
        return await fn(client, version)
      } catch {
        return null
      }
    }
    const commit = async (res: Response): Promise<boolean> => {
      if (generation.current !== gen) return true
      if (res.ok) {
        setView(toView(await res.json()))
        return true
      }
      if (res.status === 409) {
        const body = await res.json().catch(() => null) as { code?: string } | null
        if (body?.code === 'VERSION_CONFLICT') return false // caller retries once
        refresh()
        setConflict(true)
      } else {
        setView(fallback)
      }
      return true
    }
    const first = await send(fallback.version)
    if (first === null || await commit(first)) return
    const fresh = await refresh()
    if (generation.current !== gen || !fresh) return
    const second = await send(fresh.version)
    if (second === null) return
    if (second.status === 409 || !second.ok) {
      if (second.status === 409) setConflict(true)
      else setView(fallback)
      return
    }
    if (generation.current === gen) setView(toView(await second.json()))
  }, [refresh])

  const setQuantity = useCallback((variantPublicId: string, quantity: number) => {
    return mutate(
      async (c, version) => c.items.$put({ json: { variantPublicId, quantity, expectedVersion: version } }) as unknown as Promise<Response>,
      view,
    )
  }, [mutate, view])

  const removeLine = useCallback((variantPublicId: string) => {
    return mutate(
      async (c, version) => c.items[':publicId'].$delete({ param: { publicId: variantPublicId }, query: { expectedVersion: String(version) } }) as unknown as Promise<Response>,
      view,
    )
  }, [mutate, view])

  const clear = useCallback(() => {
    return mutate(
      async (c, version) => c.$delete({ query: { expectedVersion: String(version) } }) as unknown as Promise<Response>,
      view,
    )
  }, [mutate, view])

  const value = useMemo<CartContextValue>(() => ({
    ...view, loading, conflict, refresh,
    setQuantity, removeLine, clear,
  }), [view, loading, conflict, refresh, setQuantity, removeLine, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
