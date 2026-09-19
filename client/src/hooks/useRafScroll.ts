import { useEffect, useRef } from 'react'

// Scroll listeners fire per pixel; setState per pixel re-renders per pixel.
// This coalesces to one call per animation frame (passive, rAF-throttled).
export function useRafScroll(handler: (y: number) => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    let queued = false
    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        handlerRef.current(window.scrollY)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
}
