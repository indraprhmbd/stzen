import { useState } from 'react'

// Managed list editor for ops.gcal_calendar_id (csv string in, csv out).
// List CRUD instead of free-text csv: entries are trimmed, deduped, and
// can never contain commas - the typo class that 404s a whole calendar.
export default function CalendarIdList({ value, onChange }: { value: string; onChange: (csv: string) => void }) {
  const ids = value.split(',').map((s) => s.trim()).filter(Boolean)
  const [input, setInput] = useState('')
  const [err, setErr] = useState<string | null>(null)

  function add() {
    const id = input.trim()
    if (!id) return
    if (id.includes(',')) { setErr('Satu ID per baris penambahan, tanpa koma'); return }
    if (ids.some((e) => e.toLowerCase() === id.toLowerCase())) { setErr('ID sudah ada di daftar'); return }
    setErr(null)
    setInput('')
    onChange([...ids, id].join(','))
  }

  function remove(id: string) {
    setErr(null)
    onChange(ids.filter((e) => e !== id).join(','))
  }

  return (
    <div className="flex flex-col gap-2">
      {ids.length === 0 && (
        <p className="text-[12px] text-[#aeaeb2]">Belum ada kalender. Event pengingat tidak terkirim sampai ada ID di sini.</p>
      )}
      {ids.map((id) => (
        <div key={id} className="flex items-center justify-between gap-2 border border-[#e5e5ea] rounded-sm bg-white px-2.5 py-1.5">
          <code className="text-[12px] font-bold text-[#1d1d1f] break-all ad-num">{id}</code>
          <button type="button" onClick={() => remove(id)} className="ad-btn ad-btn-dark !px-2 !py-0.5 !text-[11px] shrink-0" aria-label={`Hapus ${id}`}>
            Hapus
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setErr(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="admin@gmail.com atau xxx@group.calendar.google.com"
          className="ad-input ad-num flex-1 !text-[12px]"
        />
        <button type="button" onClick={add} disabled={!input.trim()} className="ad-btn ad-btn-dark !py-1.5 !text-xs shrink-0">
          Tambah
        </button>
      </div>
      {err && <p className="text-[11px] font-semibold text-red-600">{err}</p>}
    </div>
  )
}
