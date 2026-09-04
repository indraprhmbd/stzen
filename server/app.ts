import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { errorHandler } from './shared/errors/handler'
import { rateLimit } from './shared/middleware/ratelimit'
import { authMiddleware, type AuthEnv } from './shared/middleware/auth'
import { routes as productRoutes } from './modules/products'
import { routes as orderRoutes } from './modules/orders'
import { routes as checkoutRoutes } from './modules/checkout'
import { routes as adminRoutes } from './modules/admin'
import { paymentsRoutes, webhooksRoutes } from './modules/payments'

// ─── App Factory ────────────────────────────────────────────────────────────
// Creates the Hono app with all modules composed.
// Export AppType for end-to-end type safety with hono/client.

export function createApp() {
  const app = new Hono<AuthEnv>()

  // Global middleware
  app.use('*', logger())
  app.use('*', secureHeaders())
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:4173']
  const lanOriginPattern = /^http:\/\/(192\.168|10)\.\d{1,3}\.\d{1,3}\.\d{1,3}:(5173|4173)$/

  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return undefined
        if (allowedOrigins.includes(origin)) return origin
        if (lanOriginPattern.test(origin)) return origin
        return undefined
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      credentials: true,
    })
  )

  // Global error handler
  app.onError(errorHandler)

  // Health check (unversioned, infrastructure endpoint)
  app.get('/api/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() })
  )

  // Auth gate — default-deny. Every /api/v1/* route requires a valid JWT
  // unless explicitly allowlisted here. This replaces per-route-file
  // `.use('*', authMiddleware)` calls: a new route that forgets to wire auth
  // now fails closed (401) instead of silently serving data. Role checks
  // (requireRole('admin')) still live in each admin route file — this gate
  // only proves identity, not authorization.
  const PUBLIC_API_PREFIXES = ['/api/v1/products', '/api/v1/webhooks']
  app.use('/api/v1/*', async (c, next) => {
    if (PUBLIC_API_PREFIXES.some((p) => c.req.path.startsWith(p))) {
      return next()
    }
    return authMiddleware(c, next)
  })

  // Rate limits (in-memory, single instance)
  app.use('/api/v1/admin/*', rateLimit(60, 60_000))
  app.use('/api/v1/checkout/*', rateLimit(30, 60_000))
  app.use('/api/v1/payments/*', rateLimit(30, 60_000))
  // Webhooks get their own lenient limit — gateway retries shouldn't 429 into a dropped payment.
  app.use('/api/v1/webhooks/*', rateLimit(120, 60_000))

  // ─── API v1 ─────────────────────────────────────────────────────────────
  app.route('/api/v1/products', productRoutes)
  app.route('/api/v1/checkout', checkoutRoutes)
  app.route('/api/v1/orders', orderRoutes)
  app.route('/api/v1/admin', adminRoutes)
  app.route('/api/v1/payments', paymentsRoutes)
  // PUBLIC — no authMiddleware. Gateways call this directly; each provider
  // verifies its own signature inside parseWebhook.
  app.route('/api/v1/webhooks', webhooksRoutes)

  // 404 catch-all
  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  return app
}

export type AppType = ReturnType<typeof createApp>
