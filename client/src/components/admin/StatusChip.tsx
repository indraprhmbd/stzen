export type ChipTone = 'amber' | 'blue' | 'green' | 'red' | 'zinc' | 'emerald' | 'dark' | 'violet'

const toneClasses: Record<ChipTone, string> = {
  amber: 'ad-chip-amber',
  blue: 'ad-chip-blue',
  green: 'ad-chip-green',
  red: 'ad-chip-red',
  zinc: 'ad-chip-zinc',
  emerald: 'ad-chip-green',
  dark: 'ad-chip-zinc',
  violet: 'ad-chip-violet',
}

export const orderStatusTone: Record<string, ChipTone> = {
  PENDING: 'amber',
  PAID: 'blue',
  DELIVERED: 'green',
  REJECTED: 'red',
  REFUNDED: 'violet',
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
    <span className={`ad-chip ad-num ${toneClasses[resolved]} ${className}`}>
      {children}
    </span>
  )
}
