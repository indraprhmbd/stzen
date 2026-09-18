import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTableSort } from './useTableSort'
import { PAGE_SIZE_OPTIONS } from '../components/admin/TablePagination'

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface TableParamsOpts<TFilter extends string> {
  /** URL key pair for useTableSort server mode (e.g. 'sort'). */
  sortUrlKey: string
  defaultSortKey?: string
  defaultSortDir?: 'asc' | 'desc' | null
  /** URL key for the filter tab (e.g. 'state'). */
  filterKey: string
  filters: readonly TFilter[]
  defaultFilter: TFilter
  defaultLimit?: number
}

// Shared admin-table state contract (see docs/admin-table-persistence*).
// URL: sort/sort_dir (via useTableSort), filter tab, q (committed), page
// (1-based), limit. Local: search draft, selection, busy flags.
export function useAdminTableParams<TFilter extends string>(opts: TableParamsOpts<TFilter>) {
  const {
    sortUrlKey, defaultSortKey, defaultSortDir = null,
    filterKey, filters, defaultFilter, defaultLimit = 10,
  } = opts
  const [searchParams, setSearchParams] = useSearchParams()

  const { sortKey, sortDir, toggleSort } = useTableSort([], {
    urlKey: sortUrlKey, defaultKey: defaultSortKey, defaultDir: defaultSortDir,
  })

  // --- Filter tab: validated, default omitted, push (navigation) ---
  const rawFilter = searchParams.get(filterKey)
  const filter: TFilter = filters.includes(rawFilter as TFilter) ? (rawFilter as TFilter) : defaultFilter
  function setFilter(next: TFilter) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (next === defaultFilter) p.delete(filterKey)
      else p.set(filterKey, next)
      p.delete('page')
      return p
    })
  }

  // --- Search: local draft, debounced commit via replace ---
  const urlQ = searchParams.get('q') ?? ''
  const [q, setQ] = useState(urlQ)
  const committedQ = useDebounce(q)
  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (committedQ === current) return
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (committedQ) p.set('q', committedQ)
      else p.delete('q')
      p.delete('page')
      return p
    }, { replace: true })
  }, [committedQ])
  // Back/forward: adopt external URL changes, never clobber a live draft.
  useEffect(() => {
    if (q === committedQ && urlQ !== q) setQ(urlQ)
  }, [urlQ])

  // --- Page (1-based) + limit ---
  const rawPage = parseInt(searchParams.get('page') ?? '', 10)
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
  function setPage(next: number) {
    const n = Math.max(1, Math.floor(next) || 1)
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (n === 1) p.delete('page')
      else p.set('page', String(n))
      return p
    })
  }
  const rawLimit = parseInt(searchParams.get('limit') ?? '', 10)
  const limit = PAGE_SIZE_OPTIONS.includes(rawLimit) ? rawLimit : defaultLimit
  function setLimit(next: number) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (next === defaultLimit) p.delete('limit')
      else p.set('limit', String(next))
      p.delete('page')
      return p
    }, { replace: true })
  }

  return {
    filter, setFilter,
    q, setQ, committedQ,
    page, setPage, limit, setLimit,
    offset: (page - 1) * limit,
    sortKey, sortDir, toggleSort,
  }
}
