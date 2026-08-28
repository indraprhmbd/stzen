import { useState, useEffect } from 'react'

interface CopyToastProps {
  message: string
  onDone: () => void
}

export default function CopyToast({ message, onDone }: CopyToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 200)
    }, 2000)
    return () => clearTimeout(timer)
  }, [onDone])

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-toast-in">
      <div className="bg-on-surface text-primary-container border-[3px] border-on-surface shadow-brutal px-4 py-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">check_circle</span>
        <span
          className="font-black text-xs uppercase tracking-wide"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {message}
        </span>
      </div>
    </div>
  )
}
