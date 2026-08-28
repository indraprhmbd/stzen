import { RefObject } from 'react'
import { useCopy } from '../hooks/useCopy'

interface FilterBarProps {
  categories: string[]
  active: string
  onChange: (category: string) => void
  counts?: Record<string, number>
  sort: string
  onSortChange: (sort: string) => void
  view: 'grid' | 'list'
  onViewChange: (view: 'grid' | 'list') => void
  searchQuery: string
  onSearchChange: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
}

// Category-based colors
const categoryColorMap: Record<string, { active: string; hover: string }> = {
  all: { active: 'bg-on-surface text-primary-container', hover: 'hover:bg-on-surface/80' },
  streaming: { active: 'bg-secondary text-white', hover: 'hover:bg-secondary/80' },
  'ai tools': { active: 'bg-primary-container text-black', hover: 'hover:bg-primary-container/80' },
  productivity: { active: 'bg-tertiary text-white', hover: 'hover:bg-tertiary/80' },
}

const fallbackColors = [
  { active: 'bg-secondary text-white', hover: 'hover:bg-secondary/80' },
  { active: 'bg-tertiary text-white', hover: 'hover:bg-tertiary/80' },
  { active: 'bg-primary-container text-black', hover: 'hover:bg-primary-container/80' },
]

function getCategoryColor(category: string, index: number) {
  const key = category.toLowerCase()
  if (categoryColorMap[key]) return categoryColorMap[key]
  return fallbackColors[index % fallbackColors.length]
}

export default function FilterBar({ categories, active, onChange, counts = {}, sort, onSortChange, view, onViewChange, searchQuery, onSearchChange, searchRef }: FilterBarProps) {
  const { t } = useCopy()

  return (
    <div className="sticky top-16 z-40 -mx-4 px-4 py-2 mb-4">
      {/* Mobile: 2 rows */}
      <div className="md:hidden flex flex-col gap-1.5">
        {/* Row 1: Search + Sort + View */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-1.5 top-1/2 -translate-y-1/2 text-on-surface/40 text-xs">
              search
            </span>
            <input
              ref={searchRef}
              type="text"
              placeholder={t.hero.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-surface-container border-[2px] border-on-surface font-black text-[10px] uppercase pl-6 pr-1.5 py-1.5 shadow-brutal-sm rounded-sm text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:ring-2 focus:ring-primary-container"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            />
          </div>
          <select
            className="bg-surface-container border-[2px] border-on-surface font-black text-[10px] uppercase px-1.5 py-1.5 shadow-brutal-sm rounded-sm text-on-surface cursor-pointer shrink-0"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="newest">{t.products.sortNewest}</option>
            <option value="price">{t.products.sortPrice}</option>
            <option value="stock">{t.products.sortStock}</option>
          </select>
          <div className="flex border-[2px] border-on-surface shadow-brutal-sm rounded-sm overflow-hidden shrink-0">
            <button
              className={`p-1.5 transition-colors ${view === 'grid' ? 'bg-on-surface text-primary-container' : 'bg-surface-container text-on-surface'}`}
              onClick={() => onViewChange('grid')}
              aria-label="Grid view"
            >
              <span className="material-symbols-outlined text-xs">grid_view</span>
            </button>
            <button
              className={`p-1.5 transition-colors ${view === 'list' ? 'bg-on-surface text-primary-container' : 'bg-surface-container text-on-surface'}`}
              onClick={() => onViewChange('list')}
              aria-label="List view"
            >
              <span className="material-symbols-outlined text-xs">view_list</span>
            </button>
          </div>
        </div>
        {/* Row 2: Category pills (scrollable) */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          {categories.map((cat, index) => {
            const isActive = active === cat
            const count = counts[cat]
            const colors = getCategoryColor(cat, index)
            return (
              <button
                key={cat}
                className={`
                  border-[2px] border-on-surface font-black uppercase text-[9px] tracking-wide px-2.5 py-1 shrink-0
                  transition-all
                  ${isActive
                    ? `${colors.active} shadow-brutal translate-x-[1px] translate-y-[1px]`
                    : `bg-surface-container text-on-surface shadow-brutal-sm ${colors.hover}`
                  }
                `}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                onClick={() => onChange(cat)}
              >
                {cat === 'all' ? t.filter.all : cat}
                {count !== undefined && count > 0 && (
                  <span className="ml-1 font-mono text-[8px] opacity-70">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Desktop: single row */}
      <div className="hidden md:flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface/40 text-sm">
            search
          </span>
          <input
            ref={searchRef}
            type="text"
            placeholder={t.hero.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-surface-container border-[3px] border-on-surface font-black text-xs uppercase pl-7 pr-12 py-2 shadow-brutal-sm rounded-sm text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:ring-2 focus:ring-primary-container w-52"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-on-surface/30 border border-on-surface/20 px-1 py-0.5 rounded-sm">
            Ctrl+K
          </span>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 flex-1">
          {categories.map((cat, index) => {
            const isActive = active === cat
            const count = counts[cat]
            const colors = getCategoryColor(cat, index)
            return (
              <button
                key={cat}
                className={`
                  border-[3px] border-on-surface font-black uppercase text-xs tracking-wide px-4 py-2
                  transition-all
                  ${isActive
                    ? `${colors.active} shadow-brutal translate-x-[1px] translate-y-[1px]`
                    : `bg-surface-container text-on-surface shadow-brutal-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-brutal ${colors.hover}`
                  }
                `}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                onClick={() => onChange(cat)}
              >
                {cat === 'all' ? t.filter.all : cat}
                {count !== undefined && count > 0 && (
                  <span className="ml-1.5 font-mono text-[10px] opacity-70">{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Sort + View controls */}
        <div className="flex items-center gap-2">
          <select
            className="bg-surface-container border-[3px] border-on-surface font-black text-xs uppercase px-3 py-2 shadow-brutal-sm rounded-sm text-on-surface cursor-pointer"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="newest">{t.products.sortNewest}</option>
            <option value="price">{t.products.sortPrice}</option>
            <option value="stock">{t.products.sortStock}</option>
          </select>
          <div className="flex border-[3px] border-on-surface shadow-brutal-sm rounded-sm overflow-hidden">
            <button
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-on-surface text-primary-container' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
              onClick={() => onViewChange('grid')}
              aria-label="Grid view"
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
            </button>
            <button
              className={`p-2 transition-colors ${view === 'list' ? 'bg-on-surface text-primary-container' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
              onClick={() => onViewChange('list')}
              aria-label="List view"
            >
              <span className="material-symbols-outlined text-sm">view_list</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
