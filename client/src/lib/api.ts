import { hc } from 'hono/client'
import type { AppType } from '../../../server/app'
import { supabase } from './supabase'

// ─── API Client ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Full app client (includes health check)
export const api = hc<AppType>(API_BASE)

// V1 convenience client (most common usage)
// Usage: apiV1.products.$get(), apiV1.admin.products.$get()
export const apiV1 = hc<AppType>(`${API_BASE}/api/v1`)

// ─── Authed Request Helper ──────────────────────────────────────────────────
// Injects Authorization header from current Supabase session.
// Usage: const data = await authedApiRequest(c => c.orders.$get())

export async function authedApiRequest<T>(
  fn: (client: ReturnType<typeof hc<AppType>>) => Promise<T>
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const client = hc<AppType>(API_BASE, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  return fn(client)
}
