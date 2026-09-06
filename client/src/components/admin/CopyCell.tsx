import { useState } from 'react'
import { Copy, Check } from 'iconoir-react'

// Reusable copy-to-clipboard cell: value text plus a subtle copy icon.
// Self-contained feedback (icon swaps to check briefly) so callers need no
// toast plumbing. Stops propagation for rows that are themselves clickable.
export default function CopyCell({ value, display, className = '' }: {
  value: string
  display?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{display ?? value}</span>
      <button
        onClick={copy}
        title="Salin"
        aria-label={`Salin ${value}`}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-[#aeaeb2] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
      >
        {copied
          ? <Check width={13} height={13} strokeWidth={2} className="text-emerald-600" />
          : <Copy width={13} height={13} strokeWidth={1.5} />}
      </button>
    </span>
  )
}
