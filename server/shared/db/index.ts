import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from '../lib/runtime-env'

// ─── Lazy Supabase Clients ──────────────────────────────────────────────────
// Module top-level runs before Workers bindings exist, so clients build on
// first property access (after setRuntimeEnv) via Proxy. Call sites unchanged:
// supabaseAdmin.from(...), supabaseAdmin.rpc(...), supabaseAdmin.auth.* all work.

function lazyClient(kind: 'anon' | 'service_role'): SupabaseClient {
  let inner: SupabaseClient | null = null
  const get = (): SupabaseClient => {
    if (!inner) {
      const url = getEnv('SUPABASE_URL')
      const key = getEnv(kind === 'anon' ? 'SUPABASE_ANON_KEY' : 'SUPABASE_SERVICE_ROLE_KEY')
      if (!url || !key) {
        throw new Error('SUPABASE_URL and Supabase keys are required (wrangler secret/vars or process.env)')
      }
      inner = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    }
    return inner
  }
  return new Proxy({} as SupabaseClient, {
    get: (_t, p) => {
      const v = (get() as unknown as Record<string | symbol, unknown>)[p]
      return typeof v === 'function' ? (v as Function).bind(get()) : v
    },
  })
}

export const supabase: SupabaseClient = lazyClient('anon')

export const supabaseAdmin: SupabaseClient = lazyClient('service_role')

export type DbSupabaseClient = SupabaseClient
