import { useEffect, useMemo, useRef, useState } from 'react'
import { NavArrowDown, Search } from 'iconoir-react'

// ─── Searchable Select ──────────────────────────────────────────────────────
// Accessible single-select combobox (WAI-ARIA APG combobox pattern) with
// live-filtered typeahead. Replaces native <select> for long option lists
// (product/variant pickers, 40+ rows) where scrolling a native dropdown is
// unusable. Zero new deps - matches DataTable/ConfirmDialog's zinc-bordered
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

  // Reset search + highlight whenever the panel opens. Autofocus only on
  // fine-pointer devices - on touch screens focusing pops the keyboard and
  // covers the option list.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)))
      if (window.matchMedia('(pointer: fine)').matches) {
        requestAnimationFrame(() => inputRef.current?.focus())
      }
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
      {/* Always rendered to reserve layout height - the search panel below is
          absolutely positioned and would otherwise collapse the container. */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={`ad-input flex items-start justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed ${open ? 'invisible' : ''}`}
      >
        {selected ? (
          <span className="flex flex-col min-w-0">
            {selected.groupLabel && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aeaeb2]">{selected.groupLabel}</span>
            )}
            <span className="text-[#1d1d1f] whitespace-normal break-words">{selected.label}</span>
          </span>
        ) : (
          <span className="text-[#aeaeb2]">{placeholder}</span>
        )}
        <NavArrowDown width={16} height={16} strokeWidth={1.5} className="shrink-0 text-[#aeaeb2] mt-0.5" />
      </button>
      {open && (
        <div className="bg-white border border-[#e8e8ed] rounded-[14px] absolute left-0 right-0 top-0 z-30 overflow-hidden" style={{ boxShadow: '0 12px 48px rgb(0 0 0 / 0.12)' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f1f1f4]">
            <Search width={15} height={15} strokeWidth={1.5} className="shrink-0 text-[#aeaeb2]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Cari nama, SKU..."
              className="grow bg-transparent text-sm outline-none placeholder:text-[#aeaeb2]"
              role="combobox"
              aria-expanded="true"
              aria-controls="searchable-select-list"
              aria-activedescendant={filtered[activeIndex] ? `ss-opt-${filtered[activeIndex].value}` : undefined}
            />
            <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-[#aeaeb2] hover:text-[#1d1d1f]">Tutup</button>
          </div>
          <ul ref={listRef} id="searchable-select-list" role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-[#aeaeb2] text-center">{emptyText}</li>
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
                  o.disabled ? 'opacity-40 cursor-not-allowed' : i === activeIndex ? 'bg-[#f5f5f7] text-[#1d1d1f]' : 'hover:bg-[#f5f5f7]'
                }`}
              >
                {o.groupLabel && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aeaeb2]">{o.groupLabel}</span>
                )}
                <span className="whitespace-normal break-words">{o.label}</span>
                {o.sublabel && (
                  <span className="text-[11px] font-mono text-[#aeaeb2]">{o.sublabel}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
