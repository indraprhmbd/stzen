// Animated skeleton rows for DataTable loading state. Matches admin soft
// theme: white card, hairline borders, gray pulse bars.

export default function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="ad-card overflow-hidden">
      <table className="ad-table table table-sm w-full">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><div className="h-2.5 bg-[#f1f1f4] rounded-full w-16 animate-pulse" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <div className={`h-3 bg-[#f1f1f4] rounded-full animate-pulse ${c === 0 ? 'w-24' : c === cols - 1 ? 'w-10 ml-auto' : 'w-20'}`} style={{ animationDelay: `${r * 50}ms` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
