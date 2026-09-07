import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const { signUp, signInWithGoogle } = useAuth()
  const brand = useBrand()
  const navigate = useNavigate()
  const { t } = useCopy()

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
      await signUp(email, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-bg">
        <div className="w-full max-w-md mx-auto">
          <img src="/logo.svg" alt={brand.name} className="auth-logo" />
          <div className="auth-card">
            <div className="p-6 text-center">
              <h2 className="auth-title">{t.auth.verifyEmailTitle}</h2>
              <p className="auth-subtitle">{t.auth.verifyEmailSubtitle}</p>
              <p className="text-xs font-mono text-neutral/60 mb-6">
                {email}
              </p>
              <Link to="/login" className="auth-btn">
                {t.auth.backToLogin}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md mx-auto">
        <img src="/logo.svg" alt={brand.name} className="auth-logo" />

        <div className="auth-card">
          <div className="p-6">
            <h2 className="auth-title">{t.auth.signUpTitle}</h2>
            <p className="auth-subtitle">{t.auth.signUpSubtitle}</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder={t.auth.email}
                required
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder={t.auth.password}
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
                  {showPw ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder={t.auth.confirmPassword}
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
                  {showPw ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
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
                  t.auth.signUp
                )}
              </button>
            </form>

            <div className="auth-divider">{t.auth.or}</div>

            <button
              className="auth-btn auth-btn-secondary"
              onClick={async () => {
                await signInWithGoogle()
              }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t.auth.signInWithGoogle}
            </button>

            <p className="text-center mt-4 text-xs font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {t.auth.hasAccount}{' '}
              <Link to="/login" className="auth-link">
                {t.auth.signIn}
              </Link>
            </p>
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
