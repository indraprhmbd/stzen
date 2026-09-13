import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Shared current-password re-auth gate: re-verifies the password against
// Supabase before account or destructive actions. Each consumer owns its
// own input (Akun page, DangerZone) - the hook only holds the value and
// the verification call, so moving the Akun card never breaks DangerZone.
export function usePasswordConfirm() {
  const { user } = useAuth()
  const [pwCur, setPwCur] = useState('')

  async function confirmCurrentPassword(setMsg: (m: string | null) => void): Promise<boolean> {
    if (!user?.email || !pwCur) {
      setMsg('Masukkan kata sandi saat ini untuk konfirmasi')
      return false
    }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: pwCur })
    if (error) {
      setMsg('Kata sandi saat ini salah')
      return false
    }
    return true
  }

  return { pwCur, setPwCur, confirmCurrentPassword }
}
