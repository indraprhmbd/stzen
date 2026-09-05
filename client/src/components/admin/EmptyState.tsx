import { Archive } from 'iconoir-react'

export default function EmptyState({ text = 'Belum ada data.' }: { text?: string }) {
  return (
    <div className="text-center py-10 px-4">
      <span className="ad-squircle mx-auto mb-3 text-[#aeaeb2]">
        <Archive width={24} height={24} strokeWidth={1.5} />
      </span>
      <div className="text-[13px] text-[#6e6e73]">{text}</div>
    </div>
  )
}
