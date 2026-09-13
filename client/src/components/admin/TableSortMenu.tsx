import { type SyntheticEvent } from 'react'
import { Sort, SortDown, SortUp } from 'iconoir-react'
import type { Column } from './DataTable'

interface TableSortMenuProps {
  columns: Column[]
  sortKey?: string | null
  sortDir?: 'asc' | 'desc' | null
  onSort?: (key: string) => void
}

// Mobile-only sort control (hidden sm+). Below sm the table headers - and
// their clickable sort toggles - are replaced by stacked cards, so sort
// moves into this dropdown. Reuses the caller's toggleSort: identical
// 3-state cycle, URL params, and refetch behavior as desktop header clicks.
//
// Deliberately zero DaisyUI dropdown/menu classes: plain relative+absolute
// positioning and explicit ink colors render identically in every browser
// (Daisy's anchor-positioned dropdown misplaces and bleaches this menu in
// some Opera builds). Native details/summary owns open state - no JS.
export default function TableSortMenu({ columns, sortKey, sortDir, onSort }: TableSortMenuProps) {
  const sortable = columns.filter((c) => c.sortKey)
  if (!onSort || sortable.length === 0) return null
  const active = sortable.find((c) => c.sortKey === sortKey)

  // details/summary has no auto-dismiss: close on selection.
  function closeMenu(e: SyntheticEvent) {
    e.currentTarget.closest('details')?.removeAttribute('open')
  }

  return (
    <details className="relative inline-block sm:hidden">
      <summary aria-label="Urutkan tabel" className="ad-btn list-none [&::-webkit-details-marker]:hidden">
        <Sort width={15} height={15} strokeWidth={1.5} />
        {active ? active.label : 'Urutkan'}
        {active && sortDir === 'asc' && <SortUp width={14} height={14} strokeWidth={1.5} />}
        {active && sortDir === 'desc' && <SortDown width={14} height={14} strokeWidth={1.5} />}
      </summary>
      <ul
        className="absolute right-0 top-full z-30 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-[14px] border border-[#e8e8ed] bg-white p-2 text-[#1d1d1f]"
        style={{ boxShadow: '0 12px 48px rgb(0 0 0 / 0.12)' }}
      >
        {sortable.map((c) => {
          const isActive = c.sortKey === sortKey
          return (
            <li key={c.sortKey}>
              <button
                type="button"
                onClick={(e) => { onSort(c.sortKey!); closeMenu(e) }}
                className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7] ${isActive ? 'bg-[#f5f5f7] font-semibold' : ''}`}
              >
                <span className="flex-1">{c.label}</span>
                {isActive && sortDir === 'asc' && <SortUp width={14} height={14} strokeWidth={1.5} />}
                {isActive && sortDir === 'desc' && <SortDown width={14} height={14} strokeWidth={1.5} />}
              </button>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
