import { Tray } from '@phosphor-icons/react'

export default function EmptyState({ text = 'Belum ada data.' }: { text?: string }) {
  return (
    <div className="text-center py-10 text-sm text-zinc-500">
      <span className="text-zinc-300 mb-2 flex justify-center"><Tray size={32} weight="duotone" /></span>
      {text}
    </div>
  )
}
