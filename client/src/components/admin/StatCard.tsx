interface StatCardProps {
  value: string | number
  label: string
  sub?: string
}

export default function StatCard({ value, label, sub }: StatCardProps) {
  return (
    <div className="bg-white border border-zinc-200 p-4">
      <div className="text-2xl font-black font-mono leading-none">{value}</div>
      <div className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mt-1">
        {label}
        {sub && <span className="text-zinc-400 normal-case font-normal ml-1">{sub}</span>}
      </div>
    </div>
  )
}
