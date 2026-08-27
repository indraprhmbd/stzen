import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import v1Routes from './routes/v1'

// ─── App Setup ──────────────────────────────────────────────────────────────

const app = new Hono()

// ─── Global Middleware ──────────────────────────────────────────────────────

app.use('*', logger())
app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)

// ─── Health Check (unversioned, infrastructure endpoint) ────────────────────

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── API Versioning ─────────────────────────────────────────────────────────
// All business logic routes live under /api/v1
// When breaking changes are needed, create /api/v2 and mount alongside v1
// Deprecated versions receive security fixes only for 6 months after v2 launch

app.route('/api/v1', v1Routes)

// ─── 404 Catch-All ──────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

// ─── Export ─────────────────────────────────────────────────────────────────

export type AppType = typeof app

// ─── Start Server (Node.js) ────────────────────────────────────────────────

const port = Number(process.env.PORT) || 3000

serve({
  fetch: app.fetch,
  port,
})

console.log(`[server] running on http://localhost:${port}`)
console.log(`[server] api v1: http://localhost:${port}/api/v1`)

export default app
