// Loading placeholder mirroring the ProductDetail hero + purchase panel.
// Same grid, borders, padding, and block positions as the real page so
// content does not jump when data arrives. Related products are skipped:
// their count is unknown until load and they sit below the fold.
export default function SkeletonDetail() {
  return (
    <div className="grid md:grid-cols-[2fr_1fr] gap-3 mb-4">
      {/* HERO SECTION (left) */}
      <div className="bg-white border-comic shadow-comic p-5 md:p-6">
        <div className="h-9 md:h-12 w-2/3 bg-surface-container-high rounded-sm animate-skeleton mb-3" />
        <div className="h-3 w-full bg-surface-container-high rounded-sm animate-skeleton mb-1.5" />
        <div className="h-3 w-5/6 bg-surface-container-high rounded-sm animate-skeleton mb-3" />
        <div className="h-3 w-1/3 bg-surface-container-high rounded-sm animate-skeleton" />
      </div>

      {/* PURCHASE PANEL (right) */}
      <div className="bg-white border-comic shadow-comic p-4 flex flex-col">
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="w-24 h-7 bg-surface-container-high rounded-sm animate-skeleton" />
          <div className="w-20 h-7 bg-surface-container-high rounded-sm animate-skeleton" />
        </div>
        <div className="h-10 w-40 bg-surface-container-high rounded-sm animate-skeleton mb-4" />
        <div className="h-12 w-full bg-surface-container-high rounded-sm animate-skeleton" />
        <div className="h-9 w-full bg-surface-container-high rounded-sm animate-skeleton mt-3" />
      </div>
    </div>
  )
}
