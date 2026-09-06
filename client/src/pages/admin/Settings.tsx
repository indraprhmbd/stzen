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
  if (error) return <div className="ad-card-flat p-8 text-center"><div className="text-sm font-semibold text-red-600">Gagal memuat</div><div className="text-xs text-[#6e6e73] mt-1">{error}</div><button onClick={() => refetch()} className="ad-btn ad-btn-dark mt-4">Coba lagi</button></div>

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Pengaturan</h1>
          {fetchedAt && <p className="text-[13px] text-[#aeaeb2] mt-0.5">Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
        </div>
        <button onClick={handleSave} disabled={!dirty || saving} className="ad-btn ad-btn-dark">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>

      {msg && <p className="text-xs font-semibold text-[#1d1d1f]">{msg}</p>}

      <div className="ad-card p-5 flex flex-col gap-4 max-w-xl">
        {keys.map((k) => {
          const meta = LABELS[k] ?? { group: 'Lainnya', label: k }
          const header = meta.group !== lastGroup ? meta.group : null
          lastGroup = meta.group
          return (
            <div key={k}>
              {header && <div className="ad-card-title text-[#aeaeb2] mb-2">{header}</div>}
              <label className="ad-label">
                {meta.label}
                <input
                  type="text"
                  value={values[k] ?? ''}
                  onChange={(e) => setDraft({ ...values, [k]: e.target.value })}
                  className="ad-input mt-1.5 ad-num"
                />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
