import type { ComponentType, ReactNode } from 'react'

interface StatCardProps {
  value: string | number
  label: string
  sub?: string
  icon?: ComponentType<{ width?: number | string; height?: number | string; strokeWidth?: number | string; className?: string }>
  action?: ReactNode
  onNavigate?: () => void
}

export default function StatCard({ value, label, sub, icon: Icon, action, onNavigate }: StatCardProps) {
  return (
    <div
      className={`ad-card-flat p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3 ${onNavigate ? 'cursor-pointer transition-colors hover:border-[#d1d1d6]' : ''}`}
      {...(onNavigate ? {
        role: 'link',
        tabIndex: 0,
        onClick: onNavigate,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onNavigate()
          }
        },
      } : {})}
    >
      {Icon && (
        <span className="ad-squircle">
          <Icon width={22} height={22} strokeWidth={1.5} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[19px] sm:text-[26px] font-semibold leading-tight sm:leading-none tracking-tight ad-num break-words">{value}</div>
        <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1 sm:mt-1.5 break-words">
          {label}
          {sub && <span className="text-[#aeaeb2] normal-case font-normal ml-1">{sub}</span>}
        </div>
      </div>
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </div>
  )
}
