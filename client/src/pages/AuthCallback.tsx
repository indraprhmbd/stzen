import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase-browser'

// Module scope: survives StrictMode remounts. One PKCE code exchanges exactly
// once - the second dev-effect run with the same code would burn the consumed
// verifier and bounce a logged-in user back to /login?error=.
const exchangedCodes = new Set<string>()

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      const code = searchParams.get('code')
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (errorParam) {
        console.error('OAuth error:', errorParam, errorDescription)
        navigate(`/login?error=${encodeURIComponent(errorDescription || errorParam)}`, { replace: true })
        return
      }

      if (!code) {
        navigate('/login?error=missing_code', { replace: true })
        return
      }

      if (ran.current || exchangedCodes.has(code)) {
        // StrictMode second run, or back-button revisit: exchange already
        // in flight or done. Dashboard resolves session from storage.
        navigate('/dashboard', { replace: true })
        return
      }
      ran.current = true
      exchangedCodes.add(code)

      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (cancelled) return

        if (error || !data.session) {
          console.error('Code exchange failed:', error)
          navigate(`/login?error=${encodeURIComponent(error?.message || 'exchange_failed')}`, { replace: true })
          return
        }

        // Success - redirect to dashboard
        navigate('/dashboard', { replace: true })
      } catch (err) {
        if (cancelled) return
        console.error('Unexpected error during callback:', err)
        navigate('/login?error=unexpected', { replace: true })
      }
    }

    handleCallback()

    return () => {
      cancelled = true
    }
  }, [searchParams, navigate])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4 text-sm font-semibold">Completing sign-in...</p>
      </div>
    </div>
  )
}
