import { Children, Fragment, isValidElement, cloneElement, type ReactNode, type ReactElement } from 'react'
import { NavArrowDown } from 'iconoir-react'
import EmptyState from './EmptyState'

interface Column {
  label: string
  className?: string
  /** Field name to sort by. Omit for non-sortable columns (e.g. AKSI). */
  sortKey?: string
}

interface DataTableProps {
  columns: Column[]
  children: ReactNode
  empty?: boolean
  emptyText?: string
  colSpan?: number
  /** Current sort key (from useTableSort). */
  sortKey?: string | null
  /** Current sort direction (from useTableSort). */
  sortDir?: 'asc' | 'desc' | null
  /** Sort toggle callback (from useTableSort). */
  onSort?: (key: string) => void
}

// Recursively walks table rows (through Fragments, e.g. Products' grouped
// variant rows) and stamps each <td> with data-label="<column label>". Pure
// data attribute — zero extra DOM nodes, zero JS on the row-render call
// sites. app.css turns this into a labeled-card layout below the sm
// breakpoint, no per-page markup duplication needed.
function withMobileLabels(children: ReactNode, labels: string[]): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child

    if (child.type === Fragment) {
      const frag = child as ReactElement<{ children?: ReactNode }>
      return cloneElement(frag, undefined, withMobileLabels(frag.props.children, labels))
    }

    if (child.type === 'tr') {
      const tr = child as ReactElement<{ children?: ReactNode }>
      let colIndex = 0
      const cells = Children.toArray(tr.props.children).map((cell) => {
        if (!isValidElement(cell)) return cell
        const cellEl = cell as ReactElement<{ colSpan?: number }>
        const span = cellEl.props.colSpan ?? 1
        const label = labels[colIndex]
        colIndex += span
        if (cellEl.props.colSpan) return cellEl
        return cloneElement(cellEl, { 'data-label': label } as Record<string, unknown>)
      })
      return cloneElement(tr, undefined, cells)
    }

    return child
  })
}

export default function DataTable({ columns, children, empty, emptyText = 'Belum ada data.', colSpan, sortKey, sortDir, onSort }: DataTableProps) {
  const labels = columns.map((c) => c.label)
  return (
    <div className="overflow-x-auto">
      <table className="admin-table ad-table table table-sm w-full">
        <thead>
          <tr>
            {columns.map((c) => {
              const isSortable = !!c.sortKey && !!onSort
              const isActive = isSortable && sortKey === c.sortKey
              return (
                <th
                  key={c.label}
                  className={`${c.className ?? ''} ${isSortable ? 'cursor-pointer select-none' : ''}`}
                  onClick={isSortable ? () => onSort(c.sortKey!) : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {c.label}
                    {isSortable && (
                      <NavArrowDown
                        width={12}
                        height={12}
                        strokeWidth={2}
                        className={`transition-transform ${isActive ? 'text-[#1d1d1f]' : 'text-[#d1d1d6]'} ${isActive && sortDir === 'asc' ? 'rotate-180' : ''}`}
                      />
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={colSpan ?? columns.length} className="p-0">
                <EmptyState text={emptyText} />
              </td>
            </tr>
          ) : (
            withMobileLabels(children, labels)
          )}
        </tbody>
      </table>
    </div>
  )
}
