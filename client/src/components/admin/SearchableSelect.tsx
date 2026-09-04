import { useEffect, useMemo, useRef, useState } from 'react'

// ─── Searchable Select ──────────────────────────────────────────────────────
// Accessible single-select combobox (WAI-ARIA APG combobox pattern) with
// live-filtered typeahead. Replaces native <select> for long option lists
// (product/variant pickers, 40+ rows) where scrolling a native dropdown is
// unusable. Zero new deps — matches DataTable/ConfirmDialog's zinc-bordered
// admin visual style.

export interface SearchableSelectOption {
  value: string
  label: string
  groupLabel?: string
  sublabel?: string
  disabled?: boolean
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  emptyText = 'Tidak ada hasil',
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.groupLabel?.toLowerCase().includes(q) ||
        o.sublabel?.toLowerCase().includes(q)
    )
  }, [options, query])

  // Reset search + highlight whenever the panel opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)))
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Click outside closes
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function commit(option: SearchableSelectOption) {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[activeIndex]
      if (opt) commit(opt)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Always rendered to reserve layout height — the search panel below is
          absolutely positioned and would otherwise collapse the container. */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={`w-full flex items-start justify-between gap-2 border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed hover:border-zinc-400 focus:outline-none focus:border-zinc-900 ${open ? 'invisible' : ''}`}
      >
        {selected ? (
          <span className="flex flex-col min-w-0">
            {selected.groupLabel && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{selected.groupLabel}</span>
            )}
            <span className="text-zinc-900 whitespace-normal break-words">{selected.label}</span>
          </span>
        ) : (
          <span className="text-zinc-400">{placeholder}</span>
        )}
        <svg className="w-3.5 h-3.5 shrink-0 text-zinc-400 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="border border-zinc-900 bg-white absolute left-0 right-0 top-0 z-30 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200">
            <svg className="w-3.5 h-3.5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Cari nama, SKU..."
              className="grow bg-transparent text-sm outline-none placeholder:text-zinc-400"
              role="combobox"
              aria-expanded="true"
              aria-controls="searchable-select-list"
              aria-activedescendant={filtered[activeIndex] ? `ss-opt-${filtered[activeIndex].value}` : undefined}
            />
            <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-900">Tutup</button>
          </div>
          <ul ref={listRef} id="searchable-select-list" role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-zinc-400 text-center">{emptyText}</li>
            )}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`ss-opt-${o.value}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(o)}
                className={`px-3 py-2 text-sm cursor-pointer flex flex-col gap-0.5 ${
                  o.disabled ? 'opacity-40 cursor-not-allowed' : i === activeIndex ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100'
                }`}
              >
                {o.groupLabel && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${i === activeIndex ? 'text-zinc-400' : 'text-zinc-400'}`}>{o.groupLabel}</span>
                )}
                <span className="whitespace-normal break-words">{o.label}</span>
                {o.sublabel && (
                  <span className={`text-[11px] font-mono ${i === activeIndex ? 'text-zinc-300' : 'text-zinc-400'}`}>{o.sublabel}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
