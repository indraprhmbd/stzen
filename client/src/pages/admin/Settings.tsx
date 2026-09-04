import { useState } from 'react'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'

const LABELS: Record<string, { group: string; label: string }> = {
  'support.whatsapp': { group: 'Bantuan', label: 'WhatsApp' },
  'support.telegram': { group: 'Bantuan', label: 'Telegram' },
  'support.email': { group: 'Bantuan', label: 'Email' },
  'payment.bank_name': { group: 'Pembayaran', label: 'Bank' },
  'payment.account_number': { group: 'Pembayaran', label: 'No. Rekening' },
  'payment.account_name': { group: 'Pembayaran', label: 'Nama Rekening' },
}

export default function Settings() {
  const { data, loading, error, fetchedAt, refetch } = useAdminQuery(async () => {
    const res = await authedApiRequest((c) => c.api.v1.admin.settings.$get())
    return (await res.json()) as { keys: readonly string[]; values: Record<string, string> }
  }, [])
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  if (error) return <div className="bg-white border border-red-200 p-8 text-center"><div className="text-sm font-bold text-red-600">Gagal memuat</div><div className="text-xs text-zinc-500 mt-1">{error}</div><button onClick={() => refetch()} className="btn btn-sm bg-zinc-900 text-white rounded-sm mt-4">Coba lagi</button></div>

  const keys = data?.keys ?? []
  const values = draft ?? data?.values ?? {}
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data?.values ?? {})

  async function handleSave() {
    if (!dirty) return
    setSaving(true)
    setMsg(null)
    try {
      await authedApiRequest((c) => c.api.v1.admin.settings.$put({ json: { values: draft ?? {} } }))
      setDraft(null)
      setMsg('Pengaturan disimpan')
      await refetch()
    } catch {
      setMsg('Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  let lastGroup = ''
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-zinc-200 pb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Pengaturan</h1>
          <p className="text-sm text-zinc-500 mt-1">Rekening bank dan kontak bantuan toko{fetchedAt && <span className="font-mono text-zinc-400"> · Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}</p>
        </div>
        <button onClick={handleSave} disabled={!dirty || saving} className="text-xs font-semibold bg-zinc-900 text-white px-5 py-2 hover:bg-black disabled:opacity-40">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>

      {msg && <p className="text-xs font-semibold text-zinc-700">{msg}</p>}

      <div className="bg-white border border-zinc-200 p-5 flex flex-col gap-4 max-w-xl">
        {keys.map((k) => {
          const meta = LABELS[k] ?? { group: 'Lainnya', label: k }
          const header = meta.group !== lastGroup ? meta.group : null
          lastGroup = meta.group
          return (
            <div key={k}>
              {header && <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-zinc-400 mb-2">{header}</div>}
              <label className="text-xs font-bold tracking-widest uppercase text-zinc-500">
                {meta.label}
                <input
                  type="text"
                  value={values[k] ?? ''}
                  onChange={(e) => setDraft({ ...values, [k]: e.target.value })}
                  className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono"
                />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
