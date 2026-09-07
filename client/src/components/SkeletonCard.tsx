// Loading placeholder mirroring ProductCard shapes. `view` must match the
// list being loaded: grid (mobile vertical card + desktop grid) or list
// (desktop horizontal row). Same borders, padding, and block positions as
// the real card so content does not jump when data arrives.
export default function SkeletonCard({ view = 'grid' }: { view?: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div className="col-span-1 bg-white border-comic shadow-comic overflow-hidden">
        <div className="flex items-center gap-4 p-3">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-14 h-4 bg-surface-container-high rounded-full animate-skeleton" />
            <div className="w-14 h-4 bg-surface-container-high rounded-full animate-skeleton" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="w-3/4 h-3.5 bg-surface-container-high rounded-sm animate-skeleton" />
            <div className="w-full h-2.5 bg-surface-container-high rounded-sm animate-skeleton mt-1" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-20 h-6 bg-surface-container-high rounded-sm animate-skeleton" />
            <div className="w-14 h-7 bg-surface-container-high rounded-sm animate-skeleton" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-comic shadow-comic overflow-hidden flex flex-col">
      <div className="p-2.5 md:p-3 flex flex-col flex-1">
        <div className="w-3/4 h-3.5 bg-surface-container-high rounded-sm animate-skeleton mb-1" />
        <div className="flex flex-wrap gap-1 mb-1">
          <div className="w-16 h-4 bg-surface-container-high rounded-full animate-skeleton" />
          <div className="w-20 h-4 bg-surface-container-high rounded-full animate-skeleton" />
        </div>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <div className="w-24 h-6 bg-surface-container-high rounded-sm animate-skeleton" />
          <div className="w-16 h-7 bg-surface-container-high rounded-sm animate-skeleton" />
        </div>
      </div>
    </div>
  )
}
