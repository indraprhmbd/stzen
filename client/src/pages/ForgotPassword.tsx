import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()
  const brand = useBrand()
  const { t } = useCopy()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPassword(email)
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
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
            {sent ? (
              <>
                <h2 className="auth-title">{t.auth.emailSent}</h2>
                <p className="auth-subtitle">{t.auth.checkInbox}</p>
                <p className="text-xs font-mono text-neutral/60 mb-6">
                  {email}
                </p>
                <p className="text-xs text-neutral/50 mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {t.auth.spamHint}
                </p>
                <Link to="/login" className="auth-btn">
                  {t.auth.backToLogin}
                </Link>
              </>
            ) : (
              <>
                <h2 className="auth-title">{t.auth.forgotPasswordTitle}</h2>
                <p className="auth-subtitle">{t.auth.forgotPasswordSubtitle}</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    type="email"
                    placeholder={t.auth.email}
                    required
                    className="auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

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
                      t.auth.forgotPassword
                    )}
                  </button>
                </form>

                <p className="text-center mt-4 text-xs font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <Link to="/login" className="auth-link">
                    {t.auth.backToLogin}
                  </Link>
                </p>
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
