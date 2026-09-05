// Skeleton rows for inline table loading. Renders <tr> elements only,
// use inside existing <tbody>. No wrapper table needed.

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="pointer-events-none">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="py-3">
              <div
                className={`h-3 bg-[#f1f1f4] rounded-full animate-pulse ${c === 0 ? 'w-24' : c === cols - 1 ? 'w-10' : 'w-16'}`}
                style={{ animationDelay: `${r * 40}ms` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// Standalone skeleton for stat cards or non-table sections
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ad-card-flat p-4 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="h-7 bg-[#f1f1f4] rounded-full w-20 mb-2" />
          <div className="h-2.5 bg-[#f1f1f4] rounded-full w-24" />
        </div>
      ))}
    </div>
  )
}

export default SkeletonRows
