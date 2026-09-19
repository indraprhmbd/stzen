import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase-browser'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

// Module-level singleton store: ONE getSession + ONE onAuthStateChange
// subscription for the whole app. Previously every useAuth() mount created
// its own subscription (N listeners doing identical work, N setState storms
// on every auth event).
let state: AuthState = { session: null, user: null, loading: true }
const listeners = new Set<() => void>()
let started = false

function emit(next: Partial<AuthState>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function getSnapshot() {
  return state
}

function start() {
  if (started) return
  started = true

  // Stall guard: hung getSession must not pin the app in loading=true.
  const stall = setTimeout(() => {
    if (state.loading) emit({ loading: false })
  }, 6000)

  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      emit({ session, user: session?.user ?? null, loading: false })
      clearTimeout(stall)
    })
    .catch(() => {
      emit({ loading: false })
      clearTimeout(stall)
    })

  // Lives for the app lifetime - single instance, never unsubscribed.
  supabase.auth.onAuthStateChange((_event, session) => {
    emit({ session, user: session?.user ?? null, loading: false })
    clearTimeout(stall)
  })
}

const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}

const signInWithEmail = async (email: string, password: string) => {
  // A stalled tunnel (ngrok hiccup, captive portal) leaves the promise
  // pending forever and the login button spinning. Fail loudly instead.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Login timed out - check connection and retry')), 20000)
  )
  const attempt = supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
    if (error) throw error
  })
  await Promise.race([attempt, timeout])
}

const signUp = async (email: string, password: string) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
}

const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  })
  if (error) throw error
}

const updatePassword = async (password: string) => {
  const { error } = await supabase.auth.updateUser({
    password,
  })
  if (error) throw error
}

const resendConfirmation = async (email: string) => {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  })
  if (error) throw error
}

const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function useAuth() {
  start()
  return {
    ...useSyncExternalStore(subscribe, getSnapshot),
    signInWithGoogle,
    signInWithEmail,
    signUp,
    resetPassword,
    updatePassword,
    resendConfirmation,
    signOut,
  }
}
