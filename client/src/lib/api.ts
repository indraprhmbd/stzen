import { hc } from 'hono/client'
import type { AppType } from '../../../server/app'
import { supabase } from './supabase'

// ─── API Client ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

// Full app client (includes health check)
export const api = hc<AppType>(API_BASE)

// V1 convenience client (most common usage)
// Usage: apiV1.products.$get(), apiV1.admin.products.$get()
export const apiV1 = hc<AppType>(`${API_BASE}/api/v1`)

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
  const { data: { session } } = await withTimeout(supabase.auth.getSession(), 8000, 'getSession')

  if (!session) {
    throw new Error('Not authenticated')
  }

  const client = hc<AppType>(API_BASE, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...opts?.headers,
    },
  })

  return withTimeout(fn(client) as Promise<T>, 15000, 'api')
}
