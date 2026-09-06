import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { errorHandler } from './shared/errors/handler'
import { rateLimit } from './shared/middleware/ratelimit'
import { authMiddleware, type AuthEnv } from './shared/middleware/auth'
import { routes as authRoutes } from './modules/auth'
import { routes as productRoutes } from './modules/products'
import { routes as orderRoutes } from './modules/orders'
import { routes as checkoutRoutes } from './modules/checkout'
import { routes as adminRoutes } from './modules/admin'
import { paymentsRoutes, webhooksRoutes } from './modules/payments'
import { getSetting } from './shared/lib/settings'

// ─── App Factory ────────────────────────────────────────────────────────────
// Creates the Hono app with all modules composed.
// Export AppType for end-to-end type safety with hono/client.

export function createApp() {
  const base = new Hono<AuthEnv>()

  // Global middleware
  base.use('*', logger())
  base.use(
    '*',
    secureHeaders({
      strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        geolocation: [],
        microphone: [],
        camera: [],
      },
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.supabase.co'],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        reportUri: '/api/v1/security/csp-report',
      },
    })
  )
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const lanOriginPattern = /^http:\/\/(192\.168|10)\.\d{1,3}\.\d{1,3}\.\d{1,3}:(5173|4173)$/

  base.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return undefined
        if (corsOrigins.includes(origin)) return origin
        if (lanOriginPattern.test(origin)) return origin
        return undefined
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Vault-Token'],
      credentials: true,
    })
  )

  // Global error handler
  base.onError(errorHandler)

  // Auth gate — default-deny. Every /api/v1/* route requires a valid JWT
  // unless explicitly allowlisted here. This replaces per-route-file
  // `.use('*', authMiddleware)` calls: a new route that forgets to wire auth
  // now fails closed (401) instead of silently serving data. Role checks
  // (requireRole('admin')) still live in each admin route file — this gate
  // only proves identity, not authorization.
  const PUBLIC_API_PREFIXES = ['/api/v1/products', '/api/v1/webhooks', '/api/v1/auth']
  base.use('/api/v1/*', async (c, next) => {
    if (PUBLIC_API_PREFIXES.some((p) => c.req.path.startsWith(p))) {
      return next()
    }
    return authMiddleware(c, next)
  })

  // Rate limits (in-memory, single instance)
  base.use('/api/v1/admin/*', rateLimit(60, 60_000))
  base.use('/api/v1/checkout/*', rateLimit(30, 60_000))
  base.use('/api/v1/payments/*', rateLimit(30, 60_000))
  // Webhooks get their own lenient limit — gateway retries shouldn't 429 into a dropped payment.
  base.use('/api/v1/webhooks/*', rateLimit(120, 60_000))
  base.use('/api/v1/auth/*', rateLimit(20, 60_000))
  base.use('/api/v1/orders/*', rateLimit(60, 60_000))

  // ─── API routes ─────────────────────────────────────────────────────────
  // Chained (not sequential statements): Hono accumulates the route schema
  // into the RETURNED app's type. Discarded app.route(...) calls register at
  // runtime but leave AppType as the blank base Hono — silently voiding all
  // hono/client type safety. ReturnType<typeof createApp> must be the chain.
  const app = base
    // Health check (unversioned, infrastructure endpoint)
    .get('/api/health', (c) =>
      c.json({ status: 'ok', timestamp: new Date().toISOString() })
    )
    // Public storefront settings (unversioned, infrastructure endpoint).
    // Hardcoded allowlist: store identity plus support contacts (already
    // public by design: footer links and WA report buttons). Payment and
    // operational internals never leave the admin route.
    .get('/api/settings/public', async (c) => {
      const [name, announcement, whatsapp, telegram, email] = await Promise.all([
        getSetting('store.name', ''),
        getSetting('store.announcement', ''),
        getSetting('support.whatsapp', ''),
        getSetting('support.telegram', ''),
        getSetting('support.email', ''),
      ])
      return c.json({ name, announcement, whatsapp, telegram, email })
    })
    .route('/api/v1/auth', authRoutes)
    .route('/api/v1/products', productRoutes)
    .route('/api/v1/checkout', checkoutRoutes)
    .route('/api/v1/orders', orderRoutes)
    .route('/api/v1/admin', adminRoutes)
    .route('/api/v1/payments', paymentsRoutes)
    // PUBLIC — no authMiddleware. Gateways call this directly; each provider
    // verifies its own signature inside parseWebhook.
    .route('/api/v1/webhooks', webhooksRoutes)

  // 404 catch-all
  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  return app
}

export type AppType = ReturnType<typeof createApp>
