import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// No manual exchangeCodeForSession here: the supabase client auto-detects
// ?code= in the URL (detectSessionInUrl) and exchanges exactly once at init.
// A manual call races it - the loser finds the consumed verifier gone and
// throws "PKCE code verifier not found". This page just waits for the
// resulting session, then routes.
export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const settled = useRef(false)

  useEffect(() => {
    let cancelled = false

    function done(path: string) {
      if (cancelled || settled.current) return
      settled.current = true
      navigate(path, { replace: true })
    }

    const errorParam = searchParams.get('error')
    if (errorParam) {
      const desc = searchParams.get('error_description')
      console.error('OAuth error:', errorParam, desc)
      done(`/login?error=${encodeURIComponent(desc || errorParam)}`)
      return
    }

    if (!searchParams.get('code')) {
      done('/login?error=missing_code')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) done('/dashboard')
      }
    )

    // Fallback: session may already exist (or auto-exchange already done).
    const t = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        done(session ? '/dashboard' : '/login?error=exchange_timeout')
      } catch {
        done('/login?error=exchange_timeout')
      }
    }, 8000)

    return () => {
      cancelled = true
      clearTimeout(t)
      subscription.unsubscribe()
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
