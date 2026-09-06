import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import { useAuth } from '../../hooks/useAuth'

const LABELS: Record<string, { group: string; label: string; hint?: string; type?: 'text' | 'number'; min?: number; max?: number }> = {
  'store.name': { group: 'Toko', label: 'Nama toko' },
  'store.announcement': { group: 'Toko', label: 'Pengumuman', hint: 'Kosongkan untuk menyembunyikan banner katalog' },
  'support.whatsapp': { group: 'Bantuan', label: 'WhatsApp' },
  'support.telegram': { group: 'Bantuan', label: 'Telegram' },
  'support.email': { group: 'Bantuan', label: 'Email' },
  'payment.bank_name': { group: 'Pembayaran', label: 'Bank' },
  'payment.account_number': { group: 'Pembayaran', label: 'No. Rekening' },
  'payment.account_name': { group: 'Pembayaran', label: 'Nama Rekening' },
  'ops.low_threshold': { group: 'Operasional', label: 'Ambang stok menipis', hint: 'Varian di bawah jumlah ini masuk kartu Stok Menipis', type: 'number', min: 1, max: 100 },
  'ops.vault_lock_minutes': { group: 'Operasional', label: 'Vault terkunci otomatis (menit)', hint: 'Masa berlaku token buka vault', type: 'number', min: 1, max: 60 },
  'ops.csv_limit': { group: 'Operasional', label: 'Batas ekspor CSV', hint: 'Maksimal baris per ekspor pesanan', type: 'number', min: 100, max: 5000 },
}

const GROUP_ORDER = ['Toko', 'Pembayaran', 'Operasional']

export default function Settings() {
  const { data, loading, error, fetchedAt, refetch } = useAdminQuery(async () => {
    const res = await authedApiRequest((c) => c.api.v1.admin.settings.$get())
    return (await res.json()) as { keys: readonly string[]; values: Record<string, string> }
  }, [])
  const { user } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [pwCur, setPwCur] = useState('')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwSaving, setPwSaving] = useState(false)
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

  // Re-auth gate: every account action re-verifies the current password
  // against Supabase before touching credentials or sessions.
  async function confirmCurrentPassword(): Promise<boolean> {
    if (!user?.email || !pwCur) {
      setPwMsg('Masukkan kata sandi saat ini untuk konfirmasi')
      return false
    }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: pwCur })
    if (error) {
      setPwMsg('Kata sandi saat ini salah')
      return false
    }
    return true
  }

  async function handlePassword() {
    setPwMsg(null)
    if (pw1.length < 8) { setPwMsg('Kata sandi minimal 8 karakter'); return }
    if (pw1 !== pw2) { setPwMsg('Konfirmasi tidak cocok'); return }
    if (!(await confirmCurrentPassword())) return
    setPwSaving(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: pw1 })
      if (err) throw err
      setPwCur(''); setPw1(''); setPw2('')
      setPwMsg('Kata sandi diperbarui')
    } catch {
      setPwMsg('Gagal memperbarui kata sandi')
    } finally {
      setPwSaving(false)
    }
  }

  async function signOutEverywhere() {
    setPwMsg(null)
    if (!(await confirmCurrentPassword())) return
    await supabase.auth.signOut({ scope: 'global' }).catch(() => {})
    navigate('/login', { replace: true })
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

      <div className="ad-card p-5 flex flex-col gap-4">
        <div className="ad-card-title text-[#aeaeb2]">Akun</div>
        <div className="text-[13px]">
          <span className="text-[#6e6e73]">Masuk sebagai </span>
          <span className="font-semibold ad-num">{user?.email ?? '-'}</span>
        </div>
        <div className="flex flex-col gap-3">
          <label className="ad-label">
            Kata sandi saat ini
            <input type="password" value={pwCur} onChange={(e) => setPwCur(e.target.value)} placeholder="Konfirmasi untuk setiap tindakan akun" autoComplete="current-password" className="ad-input mt-1.5" />
          </label>
          <label className="ad-label">
            Kata sandi baru
            <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Minimal 8 karakter" autoComplete="new-password" className="ad-input mt-1.5" />
          </label>
          <label className="ad-label">
            Konfirmasi kata sandi
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Ulangi kata sandi" autoComplete="new-password" className="ad-input mt-1.5" />
          </label>
          {pwMsg && <p className="text-xs font-semibold text-[#1d1d1f]">{pwMsg}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePassword} disabled={pwSaving || !pw1 || !pw2} className="ad-btn ad-btn-dark">{pwSaving ? 'Menyimpan...' : 'Ubah kata sandi'}</button>
            <button onClick={signOutEverywhere} className="ad-btn ad-btn-danger">Keluar dari semua perangkat</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
