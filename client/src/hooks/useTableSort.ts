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

function autoCompare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b))
}

function sortData<T>(data: T[], key: string | null, dir: SortDir): T[] {
  if (!key || !dir) return data
  const sorted = [...data].sort((a, b) => autoCompare((a as any)[key], (b as any)[key]))
  return dir === 'desc' ? sorted.reverse() : sorted
}

function cycleDir(current: SortDir, defaultDir: SortDir): SortDir {
  if (current === 'asc') return 'desc'
  if (current === 'desc') return defaultDir
  return 'asc'
}

export function useTableSort<T>(data: T[], opts: SortOpts = {}): SortResult<T> {
  const { defaultKey, defaultDir = null, urlKey } = opts
  const isServer = !!urlKey

  // --- Server mode: URL params ---
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = urlKey ? (searchParams.get(urlKey) ?? null) : null
  const urlSortDir = urlKey ? ((searchParams.get(`${urlKey}_dir`) as SortDir) ?? defaultDir) : null

  const toggleSortServer = useCallback((key: string) => {
    if (!urlKey) return
    const currentKey = searchParams.get(urlKey)
    const currentDir = searchParams.get(`${urlKey}_dir`) as SortDir | null
    let newKey: string | null = key
    let newDir: SortDir
    if (currentKey === key) {
      newDir = cycleDir(currentDir, defaultDir)
      if (newDir === defaultDir) newKey = null
    } else {
      newDir = 'asc'
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (newKey && newDir) { next.set(urlKey, newKey); next.set(`${urlKey}_dir`, newDir) }
      else { next.delete(urlKey); next.delete(`${urlKey}_dir`) }
      next.delete('page'); next.delete('offset')
      return next
    }, { replace: true })
  }, [urlKey, searchParams, setSearchParams, defaultDir])

  // --- Client mode: single sort state ---
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({
    key: defaultKey ?? null, dir: defaultDir,
  })

  const toggleSortLocal = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key === key) {
        const newDir = cycleDir(prev.dir, defaultDir)
        return { key: newDir === defaultDir ? null : key, dir: newDir }
      }
      return { key, dir: 'asc' }
    })
  }, [defaultDir])

  const activeKey = isServer ? urlSortKey : sort.key
  const activeDir = isServer ? (urlSortDir ?? defaultDir) : sort.dir
  const toggleSort = isServer ? toggleSortServer : toggleSortLocal

  const sorted = useMemo(
    () => isServer ? data : sortData(data, activeKey, activeDir),
    [data, activeKey, activeDir, isServer]
  )

  return { sorted, sortKey: activeKey, sortDir: activeDir, toggleSort }
}
