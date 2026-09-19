import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeClosed } from 'iconoir-react'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const { updatePassword } = useAuth()
  const brand = useBrand()
  const navigate = useNavigate()
  const { t } = useCopy()

  useEffect(() => {
    // Supabase handles the token from the email link in the URL hash on mount.
    // No extra parsing needed; updatePassword uses the current session.
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      await updatePassword(password)
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md mx-auto">
        <img src="/logo.svg" alt={brand.name} className="auth-logo" />

        <div className="auth-card">
          <div className="p-6">
            {success ? (
              <>
                <h2 className="auth-title">{t.auth.successRedirect}</h2>
                <p className="auth-subtitle">{t.auth.checkInbox}</p>
              </>
            ) : (
              <>
                <h2 className="auth-title">{t.auth.updatePasswordTitle}</h2>
                <p className="auth-subtitle">{t.auth.updatePasswordSubtitle}</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder={t.auth.newPassword}
                      required
                      minLength={8}
                      className="auth-input pr-10 [&::-ms-reveal]:hidden"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0D110F]/60 hover:text-[#0D110F]"
                    >
                      {showPw ? <EyeClosed width={18} height={18} strokeWidth={2} /> : <Eye width={18} height={18} strokeWidth={2} />}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder={t.auth.confirmNewPassword}
                      required
                      minLength={8}
                      className="auth-input pr-10 [&::-ms-reveal]:hidden"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0D110F]/60 hover:text-[#0D110F]"
                    >
                      {showPw ? <EyeClosed width={18} height={18} strokeWidth={2} /> : <Eye width={18} height={18} strokeWidth={2} />}
                    </button>
                  </div>

                  {error && (
                    <div className="auth-alert">
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="auth-btn"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      t.auth.updatePassword
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <div className="text-center mt-4">
          <Link to="/" className="auth-link">
            {t.auth.backToStore}
          </Link>
        </div>
      </div>
    </div>
  )
}
