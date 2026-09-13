import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePasswordConfirm } from '../../hooks/usePasswordConfirm'
import { Shop, LogOut } from 'iconoir-react'

// Dedicated account menu: identity, password change, sign-out (this device
// + everywhere), back to store. Moved out of Settings so it is reachable
// from the mobile bottom nav.
export default function Account() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pwCur, setPwCur, confirmCurrentPassword } = usePasswordConfirm()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwSaving, setPwSaving] = useState(false)

  async function handlePassword() {
    setPwMsg(null)
    if (pw1.length < 8) { setPwMsg('Kata sandi minimal 8 karakter'); return }
    if (pw1 !== pw2) { setPwMsg('Konfirmasi tidak cocok'); return }
    if (!(await confirmCurrentPassword(setPwMsg))) return
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
    if (!(await confirmCurrentPassword(setPwMsg))) return
    await supabase.auth.signOut({ scope: 'global' }).catch(() => {})
    navigate('/login', { replace: true })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Akun</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5 ad-num">{user?.email ?? '-'}</p>
      </div>

      <div className="ad-card p-5 flex flex-col gap-4">
        <div className="ad-card-title text-[#aeaeb2]">Keamanan</div>
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
          </div>
        </div>
      </div>

      <div className="ad-card p-5 flex flex-col gap-3">
        <div className="ad-card-title text-[#aeaeb2]">Sesi & Toko</div>
        <button onClick={handleSignOut} className="ad-btn justify-start"><LogOut width={15} height={15} strokeWidth={1.5} />Keluar dari perangkat ini</button>
        <button onClick={signOutEverywhere} className="ad-btn ad-btn-danger justify-start"><LogOut width={15} height={15} strokeWidth={1.5} />Keluar dari semua perangkat</button>
        <Link to="/" className="ad-btn justify-start"><Shop width={15} height={15} strokeWidth={1.5} />Kembali ke Toko</Link>
      </div>
    </div>
  )
}
