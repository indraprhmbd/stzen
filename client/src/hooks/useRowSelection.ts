import { useRef, useState } from 'react'

// Uniform row-selection state machine for admin tables. Keyed by stable row
// id (public_id), never index — survives sort/page/filter. Presence in the
// record means selected; deselect deletes the key (never `false`).
//
// Mode is derived: empty set = 'idle' (row-body clicks inert), non-empty =
// 'armed' (row-body clicks toggle). Checkboxes always work in both modes.

export type RowSelectionMode = 'idle' | 'armed'
export type HeaderSelectionState = 'none' | 'some' | 'all'

interface ToggleOptions {
  /** Shift-held: select contiguous range from anchor within pageIds. */
  range?: boolean
  /** Ordered ids of the current page (required for range). */
  pageIds?: string[]
}

export interface RowSelection {
  selected: string[]
  count: number
  mode: RowSelectionMode
  isSelected: (id: string) => boolean
  toggle: (id: string, opts?: ToggleOptions) => void
  toggleAll: (pageIds: string[]) => void
  headerState: (pageIds: string[]) => HeaderSelectionState
  clear: () => void
}

export function useRowSelection(): RowSelection {
  const [set, setSet] = useState<Record<string, true>>({})
  // Last plain-toggled row id; range endpoint. Cleared with the set.
  const anchorRef = useRef<string | null>(null)

  const selected = Object.keys(set)
  const count = selected.length
  const mode: RowSelectionMode = count === 0 ? 'idle' : 'armed'

  function isSelected(id: string) {
    return set[id] === true
  }

  function toggle(id: string, opts?: ToggleOptions) {
    const { range, pageIds } = opts ?? {}
    setSet((prev) => {
      const next = { ...prev }
      const anchor = anchorRef.current
      if (range && pageIds && anchor && anchor !== id) {
        const a = pageIds.indexOf(anchor)
        const b = pageIds.indexOf(id)
        if (a !== -1 && b !== -1) {
          const [from, to] = a < b ? [a, b] : [b, a]
          for (let i = from; i <= to; i++) next[pageIds[i]!] = true
          return next
        }
      }
      // Plain toggle (also the fallback when the anchor left the page).
      if (next[id]) delete next[id]
      else next[id] = true
      anchorRef.current = id
      return next
    })
  }

  function toggleAll(pageIds: string[]) {
    setSet((prev) => {
      const allIn = pageIds.length > 0 && pageIds.every((id) => prev[id])
      if (allIn) {
        const next = { ...prev }
        for (const id of pageIds) delete next[id]
        if (Object.keys(next).length === 0) anchorRef.current = null
        return next
      }
      const next = { ...prev }
      for (const id of pageIds) next[id] = true
      return next
    })
  }

  function headerState(pageIds: string[]): HeaderSelectionState {
    if (pageIds.length === 0) return 'none'
    let n = 0
    for (const id of pageIds) if (set[id]) n++
    if (n === 0) return 'none'
    return n === pageIds.length ? 'all' : 'some'
  }

  function clear() {
    anchorRef.current = null
    setSet({})
  }

  return { selected, count, mode, isSelected, toggle, toggleAll, headerState, clear }
}
