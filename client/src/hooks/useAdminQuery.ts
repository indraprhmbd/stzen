import { useState, useEffect } from 'react'

interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  fetchedAt: number | null
  refetch: () => void
}

interface QueryOpts {
  // Keep previous data visible while a dep change (tab/sort/page) refetches,
  // instead of blanking to loading. Avoids full-table flash on every nav.
  keepPreviousData?: boolean
}

export function useAdminQuery<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[] = [], opts: QueryOpts = {}): QueryState<T> {
  const { keepPreviousData = false } = opts
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Abort the in-flight request on dep change: fast tab/sort/page switches
    // no longer waste a full request whose response gets discarded anyway.
    const controller = new AbortController()
    ;(async () => {
      setError(null)
      setLoading(true)
      if (!keepPreviousData) setData(null)
      try {
        const result = await fn(controller.signal)
        if (!cancelled) {
          setData(result)
          setFetchedAt(Date.now())
        }
      } catch (e: unknown) {
        // Aborts are expected churn, not errors.
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
        if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, keepPreviousData, ...deps])

  return { data, loading, error, fetchedAt, refetch: () => setNonce((n) => n + 1) }
}
