import { useCallback, useRef, useState } from 'react'
import type { ToastData, ToastType } from '../components/Toast'

const DISMISS_MS = 3000

// ─── useToast ───────────────────────────────────────────────────────────────
// Stacked auto-dismissing notifications. Usage:
//   const { toasts, showToast, dismissToast } = useToast()
//   showToast('Lunas', 'success')
//   <ToastStack toasts={toasts} onDone={dismissToast} />
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const nextId = useRef(1)

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextId.current++
      setToasts((prev) => [...prev.slice(-2), { id, message, type }])
      setTimeout(() => dismissToast(id), DISMISS_MS)
    },
    [dismissToast]
  )

  return { toasts, showToast, dismissToast }
}
