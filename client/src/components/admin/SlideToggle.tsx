import type { MouseEvent } from 'react'

interface SlideToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  busy?: boolean
  label: string
  size?: 'sm' | 'md'
}

// Reusable slide toggle. Native button + role=switch (keyboard: Enter/Space
// free via button semantics), no DaisyUI dependency so the track/knob render
// identically everywhere. Track uses explicit ink colors, not theme vars.
export default function SlideToggle({ checked, onChange, disabled = false, busy = false, label, size = 'sm' }: SlideToggleProps) {
  const off = disabled || busy
  const track = size === 'sm' ? 'h-6 w-11' : 'h-7 w-[52px]'
  const knob = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const travel = size === 'sm' ? 'translate-x-5' : 'translate-x-6'

  function handleClick(e: MouseEvent) {
    e.stopPropagation()
    if (off) return
    onChange(!checked)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={off}
      onClick={handleClick}
      className={`${track} shrink-0 rounded-full p-0.5 transition-colors duration-150 ${
        checked ? 'bg-[#1d1d1f]' : 'bg-[#d1d1d6]'
      } ${off ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`block ${knob} rounded-full bg-white transition-transform duration-150 ${
          checked ? travel : 'translate-x-0'
        } ${busy ? 'animate-pulse' : ''}`}
      />
    </button>
  )
}
