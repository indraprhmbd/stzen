interface FilterBarProps {
  categories: string[]
  active: string
  onChange: (category: string) => void
  counts?: Record<string, number>
}

export default function FilterBar({ categories, active, onChange, counts = {} }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6 justify-center">
      {categories.map((cat) => {
        const isActive = active === cat
        const count = counts[cat]
        return (
          <button
            key={cat}
            className={`
              border-[3px] border-neutral font-black uppercase text-xs tracking-wide px-4 py-2
              transition-all
              ${isActive
                ? 'bg-primary text-primary-content shadow-brutal translate-x-[1px] translate-y-[1px]'
                : 'bg-base-100 text-neutral shadow-brutal-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-brutal'
              }
            `}
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            onClick={() => onChange(cat)}
          >
            {cat === 'all' ? 'ALL' : cat}
            {count !== undefined && count > 0 && (
              <span className="ml-1.5 font-mono text-[10px] opacity-70">{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
