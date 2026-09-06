import { hc } from 'hono/client'
import type { AppType } from '../../../server/app'
import { supabase } from './supabase-browser'

// ─── API Client ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

// Full app client (includes health check)
export const api = hc<AppType>(API_BASE)

// V1 convenience client (most common usage)
// Usage: apiV1.products.$get(), apiV1.admin.products.$get()
// Navigated from the API root (NOT hc(BASE + '/api/v1')): hono/client resolves
// paths against the full AppType schema, so rooting the client below /api/v1
// orphans every path lookup. Runtime URLs are identical either way.
export const apiV1 = hc<AppType>(API_BASE).api.v1

// ─── Authed Request Helper ──────────────────────────────────────────────────
// Injects Authorization header from current Supabase session.
// Usage: const data = await authedApiRequest(c => c.orders.$get())

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(t)) as Promise<T>
}

export async function authedApiRequest<T>(
  fn: (client: ReturnType<typeof hc<AppType>>) => Promise<T>,
  opts?: { headers?: Record<string, string> }
): Promise<T> {
  const token = await getCachedToken()

  const client = hc<AppType>(API_BASE, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...opts?.headers,
    },
  })

  return withTimeout(fn(client) as Promise<T>, 15000, 'api')
}

// Session memo: supabase getSession hits storage every call, and pages like
// Overview fan out 3-4 authed requests per mount. Cache the token briefly so
// one mount costs one session read. 10s TTL keeps logout/expiry responsive.
let cachedToken: { token: string; exp: number } | null = null

async function getCachedToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.token
  const { data: { session } } = await withTimeout(supabase.auth.getSession(), 8000, 'getSession')
  if (!session) throw new Error('Not authenticated')
  cachedToken = { token: session.access_token, exp: Date.now() + 10_000 }
  return cachedToken.token
}
