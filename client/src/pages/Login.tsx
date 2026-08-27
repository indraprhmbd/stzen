import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const { brand } = useBrand()
  const navigate = useNavigate()

  async function handleGoogleLogin() {
    try {
      await signInWithGoogle()
      // Redirect happens automatically via OAuth
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed')
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmail(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-100 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-black uppercase tracking-tight text-neutral"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {brand.name}
          </h1>
          <p
            className="text-sm font-bold text-neutral/70 mt-1"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {brand.tagline}
          </p>
        </div>

        {/* Card */}
        <div className="card bg-base-200 border-brutal-thick shadow-pop-lime rounded-md">
          <div className="card-body p-6">
            {/* Google Sign-In */}
            <button
              className="btn btn-primary w-full border-brutal shadow-brutal btn-brutal-interactive font-black uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              onClick={handleGoogleLogin}
            >
              <svg
                className="w-5 h-5 mr-2"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            {/* Divider */}
            <div className="divider text-neutral/50 font-bold text-xs">OR</div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="EMAIL"
                required
                className="input input-bordered w-full bg-base-100 border-brutal font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-neutral shadow-brutal-sm rounded-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="PASSWORD"
                required
                className="input input-bordered w-full bg-base-100 border-brutal font-mono text-xs text-neutral placeholder:text-neutral/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-neutral shadow-brutal-sm rounded-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <div className="alert alert-error border-brutal shadow-brutal-sm font-bold text-xs">
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-secondary w-full border-brutal shadow-brutal btn-brutal-interactive font-black uppercase"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Back to store */}
        <div className="text-center mt-4">
          <a
            href="/"
            className="text-xs font-bold text-neutral/60 hover:text-neutral underline"
          >
            Back to store
          </a>
        </div>
      </div>
    </div>
  )
}
