export type ChipTone = 'amber' | 'blue' | 'green' | 'red' | 'zinc' | 'emerald' | 'dark'

const toneClasses: Record<ChipTone, string> = {
  amber: 'bg-white border-amber-300 text-amber-700',
  blue: 'bg-white border-blue-300 text-blue-700',
  green: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  zinc: 'bg-white border-zinc-200 text-zinc-700',
  emerald: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  dark: 'bg-zinc-900 text-white border-zinc-900',
}

export const orderStatusTone: Record<string, ChipTone> = {
  PENDING: 'amber',
  PAID: 'blue',
  DELIVERED: 'green',
  REJECTED: 'red',
  REFUNDED: 'zinc',
}

interface StatusChipProps {
  tone?: ChipTone
  status?: string
  children: React.ReactNode
  className?: string
}

export default function StatusChip({ tone, status, children, className = '' }: StatusChipProps) {
  const resolved = tone ?? (status ? orderStatusTone[status] ?? 'zinc' : 'zinc')
  return (
    <span className={`text-xs font-mono font-semibold px-2 py-1 border ${toneClasses[resolved]} ${className}`}>
      {children}
    </span>
  )
}
