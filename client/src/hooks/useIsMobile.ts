import { useSyncExternalStore } from 'react'

// Single shared resize listener no matter how many components subscribe.
// Per-component addEventListener storms (N cards = N listeners, all firing
// setState on every resize pixel) froze the catalog on mobile rotation.
let mobile = typeof window !== 'undefined' && window.innerWidth < 768
const subs = new Set<() => void>()
let attached = false

function onResize() {
  const next = window.innerWidth < 768
  if (next === mobile) return
  mobile = next
  subs.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  subs.add(fn)
  if (!attached) {
    attached = true
    window.addEventListener('resize', onResize)
  }
  return () => {
    subs.delete(fn)
    if (subs.size === 0 && attached) {
      attached = false
      window.removeEventListener('resize', onResize)
    }
  }
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => mobile, () => false)
}
