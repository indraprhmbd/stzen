import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

type SortDir = 'asc' | 'desc' | null

interface SortOpts {
  defaultKey?: string
  defaultDir?: SortDir
  /** When provided, sort state syncs to URL search params (server-side mode). */
  urlKey?: string
}

interface SortResult<T> {
  sorted: T[]
  sortKey: string | null
  sortDir: SortDir
  toggleSort: (key: string) => void
}

// Auto-detect comparator based on first non-null value's type.
function autoCompare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1  // nulls last
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b))
}

function sortData<T>(data: T[], key: string | null, dir: SortDir): T[] {
  if (!key || !dir) return data
  const sorted = [...data].sort((a, b) => {
    const va = (a as any)[key]
    const vb = (b as any)[key]
    return autoCompare(va, vb)
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}

// Cycle: null → asc → desc → null
function cycleDir(current: SortDir): SortDir {
  if (current === null) return 'asc'
  if (current === 'asc') return 'desc'
  return null
}

/**
 * Two-mode table sort hook.
 *
 * Server mode (urlKey provided):
 *   Sort state lives in URL params (?sort=X&dir=Y). Caller resets
 *   pagination on sort change. No local sorted array — server handles it.
 *
 * Client mode (no urlKey):
 *   Sort state in local useState. Returns useMemo-sorted copy of data.
 */
export function useTableSort<T>(data: T[], opts: SortOpts = {}): SortResult<T> {
  const { defaultKey, defaultDir = null, urlKey } = opts

  // --- Server mode: URL params ---
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = urlKey ? (searchParams.get(`${urlKey}`) ?? null) : null
  const urlSortDir = urlKey ? ((searchParams.get(`${urlKey}_dir`) as SortDir) ?? defaultDir) : null

  const toggleSortServer = useCallback((key: string) => {
    if (!urlKey) return
    const currentKey = searchParams.get(`${urlKey}`)
    const currentDir = searchParams.get(`${urlKey}_dir`) as SortDir | null

    let newKey: string | null = key
    let newDir: SortDir

    if (currentKey === key) {
      // Same column: cycle direction
      newDir = cycleDir(currentDir)
      if (newDir === null) newKey = null  // clear sort
    } else {
      // New column: start ascending
      newDir = 'asc'
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (newKey) {
        next.set(urlKey, newKey)
        next.set(`${urlKey}_dir`, newDir!)
      } else {
        next.delete(urlKey)
        next.delete(`${urlKey}_dir`)
      }
      // Reset pagination on sort change
      next.delete('page')
      next.delete('offset')
      return next
    }, { replace: true })
  }, [urlKey, searchParams, setSearchParams])

  // --- Client mode: local state ---
  const [localKey, setLocalKey] = useState<string | null>(defaultKey ?? null)
  const [localDir, setLocalDir] = useState<SortDir>(defaultDir)

  const toggleSortLocal = useCallback((key: string) => {
    setLocalKey((prevKey) => {
      const newKey = prevKey === key ? prevKey : key
      setLocalDir((prevDir) => {
        if (prevKey === key) return cycleDir(prevDir)
        return 'asc'
      })
      // If cycling to null, clear key too
      if (prevKey === key) {
        const nextDir = cycleDir(localDir)
        if (nextDir === null) return null
      }
      return newKey
    })
  }, [localDir])

  // --- Merge: pick mode ---
  const isServer = !!urlKey
  const activeKey = isServer ? urlSortKey : localKey
  const activeDir = isServer ? (urlSortDir ?? defaultDir) : localDir
  const toggleSort = isServer ? toggleSortServer : toggleSortLocal

  // --- Client-side sorted output (no-op for server mode) ---
  const sorted = useMemo(
    () => isServer ? data : sortData(data, activeKey, activeDir),
    [data, activeKey, activeDir, isServer]
  )

  return { sorted, sortKey: activeKey, sortDir: activeDir, toggleSort }
}
