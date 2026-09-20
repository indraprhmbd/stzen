import { useState } from 'react'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DangerZone from './DangerZone'
import CalendarIdList from '../../components/admin/CalendarIdList'

const LABELS: Record<string, { group: string; label: string; hint?: string; type?: 'text' | 'number' | 'textarea'; min?: number; max?: number }> = {
  'store.name': { group: 'Toko', label: 'Nama toko' },
  'store.announcement': { group: 'Toko', label: 'Pengumuman', hint: 'Kosongkan untuk menyembunyikan banner katalog' },
  'support.whatsapp': { group: 'Bantuan', label: 'WhatsApp' },
  'support.telegram': { group: 'Bantuan', label: 'Telegram' },
  'support.email': { group: 'Bantuan', label: 'Email' },
  'payment.bank_name': { group: 'Pembayaran', label: 'Bank' },
  'payment.account_number': { group: 'Pembayaran', label: 'No. Rekening' },
  'payment.account_name': { group: 'Pembayaran', label: 'Nama Rekening' },
  'checkout.terms_body': { group: 'Checkout', label: 'Syarat & Ketentuan', hint: 'Teks S&K di dialog checkout. Menyimpan otomatis memperbarui stempel versi: persetujuan lama hangus. Kosongkan untuk menonaktifkan checkbox.', type: 'textarea' },
  'ops.low_threshold': { group: 'Operasional', label: 'Ambang stok menipis', hint: 'Varian di bawah jumlah ini masuk kartu Stok Menipis', type: 'number', min: 1, max: 100 },
  'ops.vault_lock_minutes': { group: 'Operasional', label: 'Vault terkunci otomatis (menit)', hint: 'Masa berlaku token buka vault', type: 'number', min: 1, max: 60 },
  'ops.csv_limit': { group: 'Operasional', label: 'Batas ekspor CSV', hint: 'Maksimal baris per ekspor pesanan', type: 'number', min: 100, max: 5000 },
  'ops.notify_providers': { group: 'Operasional', label: 'Kanal pengingat', hint: 'Daftar dipisah koma, mis. gcal. Kosong = mati' },
  'ops.gcal_calendar_id': { group: 'Operasional', label: 'ID Kalender Google', hint: 'Tambahkan ID tiap kalender (email admin atau xxx@group.calendar.google.com dari menu Integrate calendar). Tiap kalender wajib dibagikan ke service account dengan akses ubah event' },
  'ops.gcal_remind_days': { group: 'Operasional', label: 'Pengingat H- (hari)', hint: 'Popup pengingat sebelum kadaluarsa, 0 = hanya hari-H', type: 'number', min: 0, max: 14 },
}

const GROUP_ORDER = ['Toko', 'Pembayaran', 'Checkout', 'Operasional']

export default function Settings() {
  const { data, loading, error, fetchedAt, refetch } = useAdminQuery(async (signal) => {
    const res = await authedApiRequest((c) => c.api.v1.admin.settings.$get(), { signal })
    return (await res.json()) as { keys: readonly string[]; values: Record<string, string> }
  }, [], { keepPreviousData: true })
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [savingGroup, setSavingGroup] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ group: string; text: string } | null>(null)

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg"></span></div>
  if (error) return <div className="ad-card-flat p-8 text-center"><div className="text-sm font-semibold text-red-600">Gagal memuat</div><div className="text-xs text-[#6e6e73] mt-1">{error}</div><button onClick={() => refetch()} className="ad-btn ad-btn-dark mt-4">Coba lagi</button></div>

  const keys = data?.keys ?? []
  const values = draft ?? data?.values ?? {}
  const base = data?.values ?? {}

  function groupDirty(items: string[]): boolean {
    if (!draft) return false
    return items.some((k) => (draft[k] ?? base[k] ?? '') !== (base[k] ?? ''))
  }

  async function handleSaveGroup(group: string, items: string[]) {
    if (!groupDirty(items) || savingGroup) return
    setSavingGroup(group)
    setMsg(null)
    try {
      const subset: Record<string, string> = {}
      for (const k of items) subset[k] = draft?.[k] ?? base[k] ?? ''
      const res = await authedApiRequest((c) => c.api.v1.admin.settings.$put({ json: { values: subset } }))
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal menyimpan')
      }
      setDraft(null)
      setMsg({ group, text: `${group} disimpan` })
      await refetch()
    } catch (e: unknown) {
      setMsg({ group, text: e instanceof Error ? e.message : 'Gagal menyimpan' })
    } finally {
      setSavingGroup(null)
    }
  }

  const grouped = GROUP_ORDER.map((g) => ({ group: g, items: keys.filter((k) => (LABELS[k]?.group ?? 'Lainnya') === g) }))
    .filter((g) => g.items.length > 0)
  const other = keys.filter((k) => !(LABELS[k] && GROUP_ORDER.includes(LABELS[k].group)))
  if (other.length > 0) grouped.push({ group: 'Lainnya', items: other })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Pengaturan</h1>
          {fetchedAt && <p className="text-[13px] text-[#aeaeb2] mt-0.5">Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {grouped.map(({ group, items }) => {
        const isDirty = groupDirty(items)
        const isSaving = savingGroup === group
        return (
        <div key={group} className="ad-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="ad-card-title text-[#aeaeb2]">{group}</div>
            <button
              onClick={() => handleSaveGroup(group, items)}
              disabled={!isDirty || savingGroup !== null}
              className="ad-btn ad-btn-dark !py-1.5 !text-xs"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
          {items.map((k) => {
            const meta = LABELS[k] ?? { group: 'Lainnya', label: k }
            if (k === 'ops.gcal_calendar_id') {
              return (
                <label key={k} className="ad-label">
                  {meta.label}
                  <div className="mt-1.5">
                    <CalendarIdList value={values[k] ?? ''} onChange={(csv) => setDraft({ ...values, [k]: csv })} />
                  </div>
                  {meta.hint && <span className="text-[11px] font-normal text-[#aeaeb2] mt-1 normal-case tracking-normal">{meta.hint}</span>}
                </label>
              )
            }
            if (meta.type === 'textarea') {
              return (
                <label key={k} className="ad-label">
                  {meta.label}
                  <textarea
                    rows={10}
                    maxLength={10_000}
                    value={values[k] ?? ''}
                    onChange={(e) => setDraft({ ...values, [k]: e.target.value })}
                    className="ad-input mt-1.5 normal-case font-mono text-xs leading-relaxed"
                  />
                  {meta.hint && <span className="text-[11px] font-normal text-[#aeaeb2] mt-1 normal-case tracking-normal">{meta.hint}</span>}
                </label>
              )
            }
            return (
              <label key={k} className="ad-label">
                {meta.label}
                <input
                  type={meta.type === 'number' ? 'number' : 'text'}
                  min={meta.min}
                  max={meta.max}
                  value={values[k] ?? ''}
                  onChange={(e) => setDraft({ ...values, [k]: e.target.value })}
                  className="ad-input mt-1.5 ad-num"
                />
                {meta.hint && <span className="text-[11px] font-normal text-[#aeaeb2] mt-1 normal-case tracking-normal">{meta.hint}</span>}
              </label>
            )
          })}
          {msg?.group === group && <p className="text-xs font-semibold text-[#1d1d1f]">{msg.text}</p>}
        </div>
        )
      })}

      <DangerZone />
      </div>
    </div>
  )
}
