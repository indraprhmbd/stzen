import type { ComponentType } from 'react'

interface StatCardProps {
  value: string | number
  label: string
  sub?: string
  icon?: ComponentType<{ width?: number | string; height?: number | string; strokeWidth?: number | string; className?: string }>
}

export default function StatCard({ value, label, sub, icon: Icon }: StatCardProps) {
  return (
    <div className="ad-card-flat p-4 flex items-start gap-3">
      {Icon && (
        <span className="ad-squircle">
          <Icon width={22} height={22} strokeWidth={1.5} />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[26px] font-semibold leading-none tracking-tight ad-num">{value}</div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-[#6e6e73] mt-1.5">
          {label}
          {sub && <span className="text-[#aeaeb2] normal-case font-normal ml-1">{sub}</span>}
        </div>
      </div>
    </div>
  )
}
