import { NavArrowLeft, NavArrowRight } from 'iconoir-react'

interface TablePaginationProps {
  total: number
  limit: number
  offset: number
  onLimitChange: (limit: number) => void
  onOffsetChange: (offset: number) => void
  unit?: string
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100]

// Reusable admin table footer: total count, per-page select, prev/next.
// Pages keep limit/offset state and reset offset on filter change.
// Adopters: History. Products, Orders, Vault still hand-roll theirs.
export default function TablePagination({
  total,
  limit,
  offset,
  onLimitChange,
  onOffsetChange,
  unit = 'entri',
}: TablePaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-[#f1f1f4]">
      <span className="text-xs ad-num text-[#6e6e73]">{total} {unit}</span>
      <div className="flex items-center gap-1.5">
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          title="Baris per halaman"
          aria-label="Baris per halaman"
          className="ad-input !w-auto !py-1.5 text-xs ad-num"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          disabled={offset === 0}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
          title="Sebelumnya"
          aria-label="Halaman sebelumnya"
          className="ad-btn !px-2.5"
        >
          <NavArrowLeft width={15} height={15} strokeWidth={1.5} />
        </button>
        <button
          disabled={offset + limit >= total}
          onClick={() => onOffsetChange(offset + limit)}
          title="Berikutnya"
          aria-label="Halaman berikutnya"
          className="ad-btn !px-2.5"
        >
          <NavArrowRight width={15} height={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
