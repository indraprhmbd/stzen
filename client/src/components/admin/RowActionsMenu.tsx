import { useState, type ReactNode, type SyntheticEvent } from 'react'
import { MoreVert } from 'iconoir-react'

export interface RowAction {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface RowActionsMenuProps {
  actions: RowAction[]
  label?: string
}

// Row overflow menu: primary CTA stays inline, everything else hides behind
// the 3-dot button. Same native details/summary state ownership as
// TableSortMenu (no JS open state, works with SSR/first paint).
//
// Positioning is split by viewport because .ad-card{overflow:hidden} clips
// any absolute dropdown inside the table:
// - mobile (<sm): viewport-fixed bottom sheet, same recipe as TableSortMenu.
// - desktop: JS-anchored fixed panel (measured from the summary rect on
//   toggle), flipping upward when the row sits near the viewport bottom.
// Returns null when there is nothing to hide.
export default function RowActionsMenu({ actions, label = 'Aksi lainnya' }: RowActionsMenuProps) {
  const [anchor, setAnchor] = useState<{ top: number; right: number; up: boolean } | null>(null)

  if (actions.length === 0) return null

  function onToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open) return
    const summary = e.currentTarget.querySelector('summary')
    const r = summary?.getBoundingClientRect()
    if (!r) return
    if (window.matchMedia('(max-width: 639px)').matches) {
      setAnchor(null)
      return
    }
    setAnchor({ top: r.top, right: window.innerWidth - r.right, up: r.bottom + 280 > window.innerHeight })
  }

  function closeMenu(e: SyntheticEvent) {
    e.currentTarget.closest('details')?.removeAttribute('open')
  }

  function run(a: RowAction, e: SyntheticEvent) {
    closeMenu(e)
    a.onClick()
  }

  return (
    <details onToggle={onToggle} className="relative inline-block group">
      <summary
        aria-label={label}
        title={label}
        className="ad-btn !px-2.5 list-none [&::-webkit-details-marker]:hidden group-open:before:content-[''] group-open:before:fixed group-open:before:inset-0 group-open:before:z-40 group-open:before:bg-black/20 group-open:relative group-open:z-50"
      >
        <MoreVert width={15} height={15} strokeWidth={1.5} />
      </summary>
      {anchor === null ? (
        <ul
          className="fixed inset-x-4 bottom-20 top-auto z-[60] max-h-[60vh] overflow-y-auto rounded-[14px] border border-[#e8e8ed] bg-white p-2 text-[#1d1d1f]"
          style={{ boxShadow: '0 12px 48px rgb(0 0 0 / 0.12)' }}
        >
          {actions.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                disabled={a.disabled}
                onClick={(e) => run(a, e)}
                className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-[#f5f5f7] disabled:opacity-40 ${a.danger ? 'font-semibold text-[#dc2626]' : 'text-[#1d1d1f]'}`}
              >
                {a.icon}
                <span className="flex-1">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul
          className="fixed z-[60] max-h-64 w-52 overflow-y-auto rounded-[12px] border border-[#e8e8ed] bg-white p-1.5 text-[#1d1d1f]"
          style={{
            boxShadow: '0 12px 48px rgb(0 0 0 / 0.12)',
            right: Math.max(8, anchor.right),
            ...(anchor.up ? { bottom: window.innerHeight - anchor.top + 6 } : { top: anchor.top + 6 }),
          }}
        >
          {actions.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                disabled={a.disabled}
                onClick={(e) => run(a, e)}
                className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-[#f5f5f7] disabled:opacity-40 ${a.danger ? 'font-semibold text-[#dc2626]' : 'text-[#1d1d1f]'}`}
              >
                {a.icon}
                <span className="flex-1">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
