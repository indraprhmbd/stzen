import { useEffect, useRef, useState } from 'react'

// Managed list editor for ops.gcal_calendar_id (csv string in, csv out).
// List CRUD instead of free-text csv: entries are trimmed, deduped, and
// can never contain commas - the typo class that 404s a whole calendar.
// Delete is two-step (Hapus -> Yakin?) so a stray click never removes an
// entry; the armed state self-reverts after a few seconds.
const ARMED_RESET_MS = 3000

export default function CalendarIdList({ value, onChange }: { value: string; onChange: (csv: string) => void }) {
  const ids = value.split(',').map((s) => s.trim()).filter(Boolean)
  const [input, setInput] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [armedId, setArmedId] = useState<string | null>(null)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current) }, [])

  function add() {
    const id = input.trim()
    if (!id) return
    if (id.includes(',')) { setErr('Satu ID per baris penambahan, tanpa koma'); return }
    if (ids.some((e) => e.toLowerCase() === id.toLowerCase())) { setErr('ID sudah ada di daftar'); return }
    setErr(null)
    setInput('')
    setArmedId(null)
    onChange([...ids, id].join(','))
  }

  function remove(id: string) {
    if (armedId !== id) {
      if (armTimer.current) clearTimeout(armTimer.current)
      setArmedId(id)
      armTimer.current = setTimeout(() => setArmedId(null), ARMED_RESET_MS)
      return
    }
    if (armTimer.current) clearTimeout(armTimer.current)
    setArmedId(null)
    setErr(null)
    onChange(ids.filter((e) => e !== id).join(','))
  }

  return (
    <div className="flex flex-col gap-2">
      {ids.length === 0 && (
        <p className="text-[12px] text-[#aeaeb2]">Belum ada kalender. Event pengingat tidak terkirim sampai ada ID di sini.</p>
      )}
      {ids.map((id) => {
        const armed = armedId === id
        return (
          <div key={id} className={`flex items-center justify-between gap-2 border rounded-sm bg-white px-2.5 py-1.5 ${armed ? 'border-red-500' : 'border-[#e5e5ea]'}`}>
            <code className="text-[12px] font-bold text-[#1d1d1f] break-all ad-num">{id}</code>
            <button
              type="button"
              onClick={() => remove(id)}
              className={`ad-btn !px-2 !py-0.5 !text-[11px] shrink-0 ${armed ? '!bg-red-600 !text-white' : 'ad-btn-dark'}`}
              aria-label={armed ? `Konfirmasi hapus ${id}` : `Hapus ${id}`}
            >
              {armed ? 'Yakin?' : 'Hapus'}
            </button>
          </div>
        )
      })}
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
