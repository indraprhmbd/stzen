export default function EmptyState({ text = 'Belum ada data.' }: { text?: string }) {
  return <div className="text-center py-10 text-sm text-zinc-500">{text}</div>
}
