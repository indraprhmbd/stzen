import { useEffect, useState, type ReactNode } from 'react'

// In-flow bulk action bar: appears only when the selection is non-empty.
// The count lives in a role=status region (present at load, announced value
// debounced so shift-range selects speak once, not per row). Clearing from
// the bar returns focus to the header checkbox via headerCheckboxId.

interface AdminBulkBarProps {
  count: number
  actions: ReactNode
  onClear: () => void
  headerCheckboxId?: string
  clearLabel?: string
}

export default function AdminBulkBar({ count, actions, onClear, headerCheckboxId, clearLabel = 'Bersihkan' }: AdminBulkBarProps) {
  const [announced, setAnnounced] = useState(count)
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(count), 250)
    return () => clearTimeout(t)
  }, [count])

  if (count === 0) return null
  function clearAndRefocus() {
    onClear()
    if (headerCheckboxId) {
      // Let the bar unmount first so focus never strands inside it.
      setTimeout(() => document.getElementById(headerCheckboxId)?.focus(), 0)
    }
  }
  return (
    <div className="ad-card p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
      <span role="status" aria-live="polite" aria-atomic="true" className="text-[13px] font-semibold text-[#1d1d1f] sm:mr-auto">
        {announced} dipilih
      </span>
      {actions}
      <button onClick={clearAndRefocus} className="ad-btn w-full sm:w-auto">{clearLabel}</button>
    </div>
  )
}
