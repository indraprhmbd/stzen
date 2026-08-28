export default function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className={`
        ${featured ? 'col-span-2' : 'col-span-1'}
        bg-white border-[3px] border-on-surface rounded-md overflow-hidden
      `}
    >
      {featured && <div className="h-1.5 bg-surface-container-high animate-skeleton" />}
      <div className="p-2.5">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-2">
          <div className="w-14 h-3 bg-surface-container-high rounded-sm animate-skeleton" />
          <div className="w-12 h-3 bg-surface-container-high rounded-sm animate-skeleton" />
        </div>
        {/* Title */}
        <div className="w-3/4 h-3.5 bg-surface-container-high rounded-sm animate-skeleton mb-1.5" />
        {/* Description */}
        <div className="w-full h-2.5 bg-surface-container-high rounded-sm animate-skeleton mb-1" />
        {featured && <div className="w-2/3 h-2.5 bg-surface-container-high rounded-sm animate-skeleton mb-2" />}
        {/* Feature chips */}
        {featured && (
          <div className="flex gap-1 mb-2">
            <div className="w-14 h-4 bg-surface-container-high rounded-sm animate-skeleton" />
            <div className="w-16 h-4 bg-surface-container-high rounded-sm animate-skeleton" />
            <div className="w-12 h-4 bg-surface-container-high rounded-sm animate-skeleton" />
          </div>
        )}
        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-2 border-t-[2px] border-on-surface/10">
          <div className="w-12 h-4 bg-surface-container-high rounded-sm animate-skeleton" />
          <div className="w-14 h-5 bg-surface-container-high rounded-sm animate-skeleton" />
        </div>
      </div>
    </div>
  )
}
