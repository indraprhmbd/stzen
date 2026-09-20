import { apiV1 } from './api'

// ─── Catalog Prefetch ───────────────────────────────────────────────────────
// Warms the product-detail route chunk + API data ahead of navigation so
// card taps render instantly. No router migration needed: Vite dedupes the
// dynamic import, and the data cache is a 60s TTL map (stale-while-revalidate
// - detail pages always refetch in background).

let chunkPromise: Promise<unknown> | null = null

export function prefetchDetailChunk(): Promise<unknown> {
  if (!chunkPromise) chunkPromise = import('../pages/ProductDetail')
  return chunkPromise.catch(() => null)
}

const DATA_TTL_MS = 60_000
// LRU-capped: unbounded Maps outlive SPA navigation and grow all session.
// On insert-at + delete-before-reinsert, Map iteration order = LRU order.
const DATA_CACHE_MAX = 50
const dataCache = new Map<string, { at: number; data: unknown }>()
// Request coalescing: concurrent hovers on the same uncached key share one
// flight instead of fanning out duplicate requests.
const inflightDetail = new Map<string, Promise<unknown>>()
const inflightList = new Map<string, Promise<unknown>>()

function cacheSetLru(map: Map<string, { at: number; data: unknown }>, key: string, data: unknown, max: number) {
  map.delete(key)
  map.set(key, { at: Date.now(), data })
  while (map.size > max) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

export function prefetchDetailData(id: string): Promise<unknown> {
  const hit = dataCache.get(id)
  if (hit && Date.now() - hit.at < DATA_TTL_MS) return Promise.resolve(hit.data)
  if (!inflightDetail.has(id)) {
    inflightDetail.set(id, apiV1.products[':id']
      .$get({ param: { id } })
      .then(async (res) => {
        if (!res.ok) return null
        const data = await res.json()
        cacheSetLru(dataCache, id, data, DATA_CACHE_MAX)
        return data
      })
      .catch(() => null)
      .finally(() => {
        inflightDetail.delete(id)
      }))
  }
  return inflightDetail.get(id) as Promise<unknown>
}

// Write-through for the detail page itself: without this the cache is only
// ever populated by card hover-prefetch, so direct nav / back-nav always
// misses. Same shape the page renders, so instant-paint stays type-safe.
export function setCachedDetail(id: string, data: unknown): void {
  cacheSetLru(dataCache, id, data, DATA_CACHE_MAX)
}

export function getCachedDetail<T>(id: string): T | null {
  const hit = dataCache.get(id)
  if (!hit || Date.now() - hit.at >= DATA_TTL_MS) return null
  return hit.data as T
}

// ─── List Cache (back-nav + page prefetch) ──────────────────────────────────
// 30s TTL: back-navigation paints instantly, pager pre-warms page+1.
// List pages always revalidate in background after a cache hit.

const LIST_TTL_MS = 30_000
const LIST_CACHE_MAX = 40
const listCache = new Map<string, { at: number; data: unknown }>()

export function listKey(query: Record<string, string | string[]>): string {
  // Normalized: same tags in different click-order / case hit the same entry
  // instead of duplicating cache rows + network requests.
  const norm = (v: string | string[]): string =>
    Array.isArray(v)
      ? [...v].map((s) => s.toUpperCase()).sort().join(',')
      : v
  return Object.keys(query)
    .sort()
    .map((k) => `${k}=${norm(query[k] as string | string[])}`)
    .join('&')
}

export function getCachedList<T>(key: string): T | null {
  const hit = listCache.get(key)
  if (!hit || Date.now() - hit.at >= LIST_TTL_MS) return null
  return hit.data as T
}

export function setCachedList(key: string, data: unknown): void {
  cacheSetLru(listCache, key, data, LIST_CACHE_MAX)
}

export function prefetchList(query: Record<string, string | string[]>): void {
  const key = listKey(query)
  if (getCachedList(key) || inflightList.has(key)) return
  const p = apiV1.products
    .$get({ query })
    .then(async (res) => {
      if (res.ok) setCachedList(key, await res.json())
    })
    .catch(() => {})
    .finally(() => {
      inflightList.delete(key)
    })
  inflightList.set(key, p)
}
