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
export default function TableSortMenu({ columns, sortKey, sortDir, onSort }: TableSortMenuProps) {
  const sortable = columns.filter((c) => c.sortKey)
  if (!onSort || sortable.length === 0) return null
  const active = sortable.find((c) => c.sortKey === sortKey)

  // details/summary has no auto-dismiss: close on selection.
  function closeMenu(e: SyntheticEvent) {
    e.currentTarget.closest('details')?.removeAttribute('open')
  }

  return (
    <details className="dropdown dropdown-end sm:hidden">
      <summary aria-label="Urutkan tabel" className="ad-btn list-none [&::-webkit-details-marker]:hidden">
        <Sort width={15} height={15} strokeWidth={1.5} />
        {active ? active.label : 'Urutkan'}
        {active && sortDir === 'asc' && <SortUp width={14} height={14} strokeWidth={1.5} />}
        {active && sortDir === 'desc' && <SortDown width={14} height={14} strokeWidth={1.5} />}
      </summary>
      <ul
        className="menu menu-sm dropdown-content z-30 mt-1 w-56 rounded-[14px] border border-[#e8e8ed] bg-white p-2"
        style={{ boxShadow: '0 12px 48px rgb(0 0 0 / 0.12)' }}
      >
        {sortable.map((c) => {
          const isActive = c.sortKey === sortKey
          return (
            <li key={c.sortKey}>
              <button
                type="button"
                onClick={(e) => { onSort(c.sortKey!); closeMenu(e) }}
                className={isActive ? 'bg-[#f5f5f7] font-semibold' : ''}
              >
                <span className="flex-1 text-left">{c.label}</span>
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
