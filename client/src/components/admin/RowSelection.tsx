import type { ReactNode } from 'react'
import type { HeaderSelectionState, RowSelection } from '../../hooks/useRowSelection'

// Shared selectable-row pieces. Row click toggles only when the selection is
// armed (non-empty); clicks inside interactive descendants keep their own
// actions. Checkboxes are native inputs: free Space handling, focus ring,
// and the indeterminate DOM property on the header box.

interface SelectableRowProps {
  id: string
  selection: RowSelection
  /** Ordered ids of the current page; enables shift-click range select. */
  pageIds: string[]
  /** Accessible name for the row checkbox, e.g. `Pilih ${id}`. */
  selectLabel: string
  children: ReactNode
  className?: string
}

export function SelectableRow({ id, selection, pageIds, selectLabel, children, className }: SelectableRowProps) {
  const on = selection.isSelected(id)
  return (
    <tr
      aria-selected={on}
      onClick={(e) => {
        if (selection.mode !== 'armed') return
        if ((e.target as HTMLElement).closest('a,input,button,label,summary')) return
        selection.toggle(id, { range: e.shiftKey, pageIds })
      }}
      className={`${selection.mode === 'armed' ? 'cursor-pointer' : ''} ${on ? 'bg-[#f5f5f7]' : ''} ${className ?? ''}`}
    >
      <td>
        <input
          type="checkbox"
          aria-label={selectLabel}
          className="checkbox checkbox-sm"
          checked={on}
          // Both MouseEvent (shift+click) and KeyboardEvent (shift+space)
          // carry shiftKey on the native event.
          onChange={(e) => selection.toggle(id, { range: (e.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey === true, pageIds })}
        />
      </td>
      {children}
    </tr>
  )
}

interface SelectAllCheckboxProps {
  state: HeaderSelectionState
  onToggle: () => void
  label: string
  id?: string
}

export function SelectAllCheckbox({ state, onToggle, label, id }: SelectAllCheckboxProps) {
  return (
    <input
      id={id}
      type="checkbox"
      aria-label={label}
      className="checkbox checkbox-sm"
      checked={state === 'all'}
      ref={(el) => {
        // indeterminate is a DOM property, not an attribute: React never
        // sets it, so it must be assigned imperatively after every render.
        if (el) el.indeterminate = state === 'some'
      }}
      onChange={onToggle}
    />
  )
}
