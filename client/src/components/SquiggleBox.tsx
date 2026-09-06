import { useId } from 'react'

// ─── SquiggleBox ──────────────────────────────────────────────────────────────
// Hand-drawn wavy container: an absolutely positioned SVG perimeter whose
// offsets complete whole sine cycles per edge (zero at corners, so the loop
// closes cleanly). Stretched with preserveAspectRatio="none" plus
// non-scaling-stroke, so the stroke stays constant at any size. Zero deps.

interface SquiggleBoxProps {
  children: React.ReactNode
  className?: string
  stroke?: string
  strokeWidth?: number
  amplitude?: number
  wavelength?: number
  /** Crisp offset shadow color (brutal sticker look on transparent bg) */
  shadow?: string
}

function squiggleRect(w: number, h: number, amp: number, wavelength: number): string {
  const pad = amp + 2
  const left = pad
  const top = pad
  const right = w - pad
  const bottom = h - pad
  const pts: string[] = []
  const push = (x: number, y: number) => pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)

  const edge = (len: number, from: number, to: number, fixed: number, horizontal: boolean) => {
    const cycles = Math.max(1, Math.round(len / wavelength))
    const steps = Math.max(8, cycles * 8)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const pos = from + (to - from) * t
      const off = amp * Math.sin(t * cycles * Math.PI * 2)
      if (horizontal) push(pos, fixed + off)
      else push(fixed + off, pos)
    }
  }

  edge(right - left, left, right, top, true)
  edge(bottom - top, top, bottom, right, false)
  edge(right - left, right, left, bottom, true)
  edge(bottom - top, bottom, top, left, false)

  return `M${pts.join(' L')} Z`
}

const W = 400
const H = 96

export default function SquiggleBox({
  children,
  className = '',
  stroke = '#FFD02F',
  strokeWidth = 2.5,
  amplitude = 4,
  wavelength = 28,
  shadow,
}: SquiggleBoxProps) {
  const d = squiggleRect(W, H, amplitude, wavelength)
  const filterId = useId()
  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {shadow && (
          <defs>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="3" dy="3" stdDeviation="0" floodColor={shadow} />
            </filter>
          </defs>
        )}
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(shadow ? { filter: `url(#${filterId})` } : {})}
        />
      </svg>
      <div className="relative px-5 py-3.5">{children}</div>
    </div>
  )
}
