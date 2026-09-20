import { Children, Fragment, isValidElement, cloneElement, useMemo, type ReactNode, type ReactElement } from 'react'
import { NavArrowDown } from 'iconoir-react'
import { SelectableRow } from './RowSelection'
import EmptyState from './EmptyState'

export interface Column {
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
  /** Leading select-all checkbox cell. Prepends a w-10 <th>; pass the
      SelectAllCheckbox from RowSelection.tsx. Empty label keeps the cell
      out of the mobile labeled-card layout (no CSS change needed). */
  selectHeader?: ReactNode
}

// Reusable admin table shell: headers + empty state + mobile data-labels.
// Body rows are caller-rendered <tr> children. For long cell text that must
// scroll horizontally instead of truncating (header stays fixed), wrap the
// cell content in <div className="ad-scrollx"> (see admin-soft.css).

// Recursively walks table rows (through Fragments, e.g. Products' grouped
// variant rows, and SelectableRow wrappers) and stamps each <td> with
// data-label="<column label>". Pure
// data attribute - zero extra DOM nodes, zero JS on the row-render call
// sites. app.css turns this into a labeled-card layout below the sm
// breakpoint, no per-page markup duplication needed.
function withMobileLabels(children: ReactNode, labels: string[]): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child

    if (child.type === Fragment) {
      const frag = child as ReactElement<{ children?: ReactNode }>
      return cloneElement(frag, undefined, withMobileLabels(frag.props.children, labels))
    }

    // SelectableRow renders its own <tr> with a leading checkbox <td>:
    // consume the empty select label so body cells align with columns.
    if (child.type === SelectableRow) {
      const sel = child as ReactElement<{ children?: ReactNode }>
      const bodyLabels = labels[0] === '' ? labels.slice(1) : labels
      return cloneElement(sel, undefined, withMobileLabels(sel.props.children, bodyLabels))
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
        // Colspan group headers and empty-labeled cells (e.g. the select
        // checkbox column) stay unlabeled: on mobile they fall into the
        // plain full-width td:not([data-label]) rule.
        if (cellEl.props.colSpan || !label) return cellEl
        return cloneElement(cellEl, { 'data-label': label } as Record<string, unknown>)
      })
      return cloneElement(tr, undefined, cells)
    }

    return child
  })
}

export default function DataTable({ columns, children, empty, emptyText = 'Belum ada data.', colSpan, sortKey, sortDir, onSort, selectHeader }: DataTableProps) {
  // The select column has no label: withMobileLabels() leaves its cells
  // unstamped so every body cell still lines up with its column label.
  const labels = selectHeader !== undefined ? ['', ...columns.map((c) => c.label)] : columns.map((c) => c.label)
  // Row stamping clones the whole subtree every render (admin tables render
  // hundreds of <td>s). Skip entirely on desktop where the mobile labeled
  // layout never applies; memoize per label-set otherwise.
  const isDesktop = useMemo(() => window.matchMedia('(min-width: 640px)').matches, [])
  const stamped = useMemo(
    () => (empty || isDesktop ? children : withMobileLabels(children, labels)),
    [empty, isDesktop, children, labels]
  )
  return (
    <div className="overflow-x-auto">
      <table className="admin-table ad-table table table-sm w-full">
        <thead>
          <tr>
            {selectHeader !== undefined && <th className="w-10">{selectHeader}</th>}
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
            stamped
          )}
        </tbody>
      </table>
    </div>
  )
}
