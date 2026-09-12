import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

interface PaginationProps {
  currentPage: number
  totalPages: number
  // Called once when the pager scrolls into view - parent pre-warms page+1.
  onPrefetchNext?: () => void
}

export default function Pagination({ currentPage, totalPages, onPrefetchNext }: PaginationProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navRef = useRef<HTMLElement | null>(null)
  const firedFor = useRef(0)

  useEffect(() => {
    if (!onPrefetchNext || currentPage === firedFor.current) return
    const el = navRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          firedFor.current = currentPage
          onPrefetchNext()
          observer.disconnect()
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onPrefetchNext, currentPage])

  if (totalPages <= 1) return null

  function goToPage(page: number) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (page <= 1) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      return params
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Build page numbers: always show first, last, and ±1 around current
  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <nav ref={navRef} className="flex items-center justify-center gap-1 mt-4" aria-label="Pagination">
      {/* Prev */}
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="bg-white border-2 border-black font-black text-xs uppercase px-3 py-1.5 shadow-comic-sm btn-comic-interactive disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="font-black text-xs px-1 text-neutral/40">…</span>
        ) : (
          <button
            key={p}
            onClick={() => goToPage(p)}
            aria-current={p === currentPage ? 'page' : undefined}
            className={`
              border-2 border-black font-black text-xs px-3 py-1.5 shadow-comic-sm btn-comic-interactive
              ${p === currentPage
                ? 'bg-neutral text-primary'
                : 'bg-white text-neutral hover:bg-primary hover:text-neutral'
              }
            `}
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="bg-white border-2 border-black font-black text-xs uppercase px-3 py-1.5 shadow-comic-sm btn-comic-interactive disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </nav>
  )
}
