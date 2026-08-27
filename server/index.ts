import { serve } from '@hono/node-server'
import { createApp } from './app'

// ─── Entrypoint ─────────────────────────────────────────────────────────────
// Minimal entrypoint. All app logic lives in app.ts.

const app = createApp()
const port = Number(process.env.PORT) || 3000

serve({
  fetch: app.fetch,
  port,
})

console.log(`[server] running on http://localhost:${port}`)
console.log(`[server] api v1: http://localhost:${port}/api/v1`)
