import { useState } from 'react'
import { useLegacyTable, getCoreRowModel, getSortedRowModel, flexRender, type SortingState, type LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'
import { NavArrowDown } from 'iconoir-react'
import EmptyState from './EmptyState'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string
    align?: 'left' | 'right' | 'center'
  }
}

interface SortableDataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, any>[]
  manualSorting?: boolean
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  empty?: boolean
  emptyText?: string
}

export default function SortableDataTable<T>({
  data,
  columns,
  manualSorting = false,
  sorting: externalSorting,
  onSortingChange,
  empty,
  emptyText = 'Belum ada data.',
}: SortableDataTableProps<T>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const sorting = externalSorting ?? internalSorting
  const setSorting = onSortingChange ?? setInternalSorting

  const table = useLegacyTable({
    columns,
    data,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    ...(manualSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
    manualSorting,
  })

  const headerGroups = table.getHeaderGroups()
  const rows = table.getRowModel().rows

  return (
    <div className="overflow-x-auto">
      <table className="admin-table ad-table table table-sm w-full">
        <thead>
          {headerGroups.map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort()
                const isSorted = h.column.getIsSorted()
                return (
                  <th
                    key={h.id}
                    colSpan={h.colSpan}
                    className={h.column.columnDef.meta?.className ?? ''}
                    onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                    style={!h.column.columnDef.meta?.className && h.column.columnDef.meta?.align ? { textAlign: h.column.columnDef.meta.align } : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {canSort && (
                        <NavArrowDown
                          width={12}
                          height={12}
                          strokeWidth={2}
                          className={`transition-transform ${isSorted ? 'text-[#1d1d1f]' : 'text-[#d1d1d6]'} ${isSorted === 'asc' ? 'rotate-180' : ''}`}
                        />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {empty || rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState text={emptyText} />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
