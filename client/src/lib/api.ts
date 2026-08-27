import { hc } from 'hono/client'
import type { AppType } from '../../../server/index'

// End-to-end type-safe API client
// Uses Hono RPC to infer types directly from server routes
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Full app client (includes health check)
export const api = hc<AppType>(API_BASE)

// V1 convenience client (most common usage)
// Usage: apiV1.admin.products.$get(), apiV1.me.$get()
export const apiV1 = hc<AppType>(`${API_BASE}/api/v1`)
