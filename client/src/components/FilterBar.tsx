import { RefObject, useEffect, useRef, useState } from 'react'
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
  availableTags?: string[]
  tagCounts?: Record<string, number>
  activeTags?: string[]
  onToggleTag?: (tag: string) => void
  onClearTags?: () => void
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

export default function FilterBar({ categories, active, onChange, counts = {}, sort, onSortChange, view, onViewChange, searchQuery, onSearchChange, searchRef, availableTags = [], tagCounts = {}, activeTags = [], onToggleTag, onClearTags }: FilterBarProps) {
  const { t } = useCopy()

  // Debounced search: typing updates the local draft instantly, the URL (and
  // its API fetch) follows 250ms after the last keystroke. Draft re-syncs
  // when the URL changes externally (e.g. clear-filters).
  const [draft, setDraft] = useState(searchQuery)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    setDraft(searchQuery)
  }, [searchQuery])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  function handleSearch(value: string) {
    // Allowlist: unicode letters/numbers, spaces, - _ . , & '. Everything
    // else (quotes, slashes, brackets, symbols) is dropped before it hits
    // state, URL, or the API. Cap 64 chars.
    const clean = value.replace(/[^\p{L}\p{N}\s\-_.,&']/gu, '').slice(0, 64)
    setDraft(clean)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onSearchChange(clean), 300)
  }

  // Tag picker: one compact button + checkbox popup (from the /tags
  // endpoint, GIN-backed server filter, no manual typing). Hidden entirely
  // when no tags exist. Popup stays open across toggles (focus never leaves
  // the dropdown), so multi-select is tap-tap-tap.
  function tagFilterDropdown() {
    if (availableTags.length === 0 || !onToggleTag) return null
    const n = activeTags.length
    return (
      <div className="dropdown shrink-0">
        <div
          tabIndex={0}
          role="button"
          aria-label="Filter tags"
          className={`
            border-2 border-black font-black uppercase tracking-wide px-1.5 py-1
            inline-flex items-center gap-1 cursor-pointer transition-all
            ${n > 0
              ? 'bg-neutral text-primary shadow-comic translate-x-[1px] translate-y-[1px]'
              : 'bg-surface-container text-on-surface shadow-comic-sm'
            }
          `}
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <span className="material-symbols-outlined text-xs leading-none">filter_alt</span>
          {n > 0 && (
            <span className="font-mono text-[8px] bg-primary-container text-black rounded-full px-1.5 leading-none py-0.5">{n}</span>
          )}
        </div>
        <div
          tabIndex={0}
          className="dropdown-content bg-surface-container border-2 border-black shadow-comic z-50 p-1.5 w-52 max-w-[calc(100vw-2rem)] max-h-64 overflow-y-auto mt-1"
        >
          {availableTags.map((tag) => {
            const isActive = activeTags.includes(tag)
            const count = tagCounts[tag]
            return (
              <button
                key={tag}
                onClick={() => onToggleTag(tag)}
                aria-pressed={isActive}
                className="flex w-full items-center gap-2 px-2 py-1.5 hover:bg-surface-container-high transition-colors"
              >
                <span className={`material-symbols-outlined text-sm leading-none ${isActive ? 'text-secondary' : 'text-on-surface/40'}`}>
                  {isActive ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span
                  className="flex-1 text-left font-black uppercase text-[10px] tracking-wide text-on-surface"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {tag}
                </span>
                {count !== undefined && count > 0 && (
                  <span className="font-mono text-[9px] text-on-surface/50">{count}</span>
                )}
              </button>
            )
          })}
          {n > 0 && onClearTags && (
            <button
              onClick={onClearTags}
              className="w-full mt-1 border-t-2 border-black/10 px-2 pt-1.5 pb-0.5 font-black uppercase text-[9px] tracking-wide text-on-surface/60 hover:text-on-surface text-left"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Hapus semua
            </button>
          )}
        </div>
      </div>
    )
  }

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
              value={draft}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-surface-container border-comic font-black text-[10px] uppercase pl-6 pr-1.5 py-1.5 shadow-comic-sm text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:ring-2 focus:ring-primary-container"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            />
          </div>
          {tagFilterDropdown()}
          <select
            className="bg-surface-container border-comic font-black text-[10px] uppercase px-1.5 py-1.5 shadow-comic-sm text-on-surface cursor-pointer shrink-0"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="newest">{t.products.sortNewest}</option>
            <option value="price">{t.products.sortPrice}</option>
            <option value="stock">{t.products.sortStock}</option>
            <option value="out_of_stock">{t.products.sortOutOfStock}</option>
          </select>
          <div className="flex border-comic shadow-comic-sm overflow-hidden shrink-0">
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
                  border-2 border-black font-black uppercase text-[9px] tracking-wide px-2.5 py-1 shrink-0
                  transition-all
                  ${isActive
                    ? `${colors.active} shadow-comic translate-x-[1px] translate-y-[1px]`
                    : `bg-surface-container text-on-surface shadow-comic-sm ${colors.hover}`
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
            value={draft}
            onChange={(e) => handleSearch(e.target.value)}
            className="bg-surface-container border-comic font-black text-xs uppercase pl-7 pr-12 py-2 shadow-comic-sm text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:ring-2 focus:ring-primary-container w-52"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-on-surface/30 border border-on-surface/20 px-1 py-0.5 rounded-sm">
            Ctrl+K
          </span>
        </div>
        {tagFilterDropdown()}

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
                  border-comic font-black uppercase text-xs tracking-wide px-4 py-2
                  transition-all
                  ${isActive
                    ? `${colors.active} shadow-comic translate-x-[1px] translate-y-[1px]`
                    : `bg-surface-container text-on-surface shadow-comic-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-comic ${colors.hover}`
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
            className="bg-surface-container border-comic font-black text-xs uppercase px-3 py-2 shadow-comic-sm text-on-surface cursor-pointer"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="newest">{t.products.sortNewest}</option>
            <option value="price">{t.products.sortPrice}</option>
            <option value="stock">{t.products.sortStock}</option>
            <option value="out_of_stock">{t.products.sortOutOfStock}</option>
          </select>
          <div className="flex border-comic shadow-comic-sm overflow-hidden">
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
