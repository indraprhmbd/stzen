import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { errorHandler } from './shared/errors/handler'
import { NotFoundError } from './shared/errors/http'
import { rateLimit } from './shared/middleware/ratelimit'
import { authMiddleware, type AuthEnv } from './shared/middleware/auth'
import { routes as authRoutes } from './modules/auth'
import { routes as productRoutes } from './modules/products'
import { routes as orderRoutes } from './modules/orders'
import { routes as checkoutRoutes } from './modules/checkout'
import { routes as adminRoutes } from './modules/admin'
import { paymentsRoutes, webhooksRoutes } from './modules/payments'
import { getSetting } from './shared/lib/settings'
import { publicSettingsRoutes } from './modules/admin'
import { getEnv, isProd } from './shared/lib/runtime-env'

// ─── App Factory ────────────────────────────────────────────────────────────
// Creates the Hono app with all modules composed.
// Export AppType for end-to-end type safety with hono/client.
// NOTE: no Bindings generic. Workers bindings arrive via setRuntimeEnv() and
// are read through getEnv(), so c.env stays unused and AuthEnv suffices.

export function createApp() {
  const base = new Hono<AuthEnv>()

  // Global middleware
  base.use('*', logger())
  base.use(
    '*',
    secureHeaders({
      // HSTS only on production HTTPS. Emitting it over http://localhost
      // or Pages preview poisons nothing (header ignored on HTTP) but flags
      // false and risks includeSubDomains preload confusion, so gate it.
      strictTransportSecurity: isProd()
        ? 'max-age=63072000; includeSubDomains; preload'
        : false,
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
  // Empty default fails closed: production deploys must set
  // CORS_ALLOWED_ORIGINS explicitly (wrangler --env production does).
  // Localhost stays for `wrangler dev` / tsx without extra config.
  const corsOrigins = (getEnv('CORS_ALLOWED_ORIGINS') || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // LAN preview convenience (phone testing on same Wi-Fi). Dev-only: never
  // bypass the allowlist in production, where the edge already pins origins.
  const lanOriginPattern = /^http:\/\/(192\.168|10)\.\d{1,3}\.\d{1,3}\.\d{1,3}:(5173|4173)$/

  base.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return undefined
        if (corsOrigins.includes(origin)) return origin
        if (!isProd() && lanOriginPattern.test(origin)) return origin
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
  // live in each scope composer (e.g. admin.routes.ts central guard) — this
  // gate only proves identity, not authorization.
  //
  // Concealed scope: /api/v1/admin/* never confirms its own existence.
  // Auth failures there (missing header, bad/expired JWT) are rethrown as
  // 404 with the standard not-found body, identical to a nonexistent route.
  // Reason is logged internally for incident response. All other prefixes
  // keep 401 so the SPA re-login flow keeps working.
  const PUBLIC_API_PREFIXES = ['/api/v1/products', '/api/v1/webhooks', '/api/v1/auth', '/api/v1/security']
  const isConcealedScope = (path: string) =>
    path === '/api/v1/admin' || path.startsWith('/api/v1/admin/')
  base.use('/api/v1/*', async (c, next) => {
    if (PUBLIC_API_PREFIXES.some((p) => c.req.path.startsWith(p))) {
      return next()
    }
    try {
      return await authMiddleware(c, next)
    } catch (err) {
      if (isConcealedScope(c.req.path)) {
        console.warn('[concealed_not_found]', {
          path: c.req.path,
          reason: c.req.header('Authorization') ? 'bad_token' : 'no_token',
        })
        throw new NotFoundError('Not found')
      }
      throw err
    }
  })

  // Rate limits (in-memory, single instance)
  base.use('/api/v1/admin/*', rateLimit(60, 60_000))
  // Danger Zone: destructive ops get their own strict bucket.
  base.use('/api/v1/admin/danger/*', rateLimit(10, 60_000))
  base.use('/api/v1/checkout/*', rateLimit(30, 60_000))
  base.use('/api/v1/payments/*', rateLimit(30, 60_000))
  // Webhooks get their own lenient limit — gateway retries shouldn't 429 into a dropped payment.
  base.use('/api/v1/webhooks/*', rateLimit(120, 60_000))
  base.use('/api/v1/auth/*', rateLimit(20, 60_000))
  base.use('/api/v1/orders/*', rateLimit(60, 60_000))
  // Public reads: scraping/enumeration surface. Lenient, but bounded.
  base.use('/api/v1/products/*', rateLimit(120, 60_000))
  base.use('/api/settings/public', rateLimit(120, 60_000))
  base.use('/api/health', rateLimit(120, 60_000))
  base.use('/api/v1/security/*', rateLimit(60, 60_000))

  // ─── API routes ─────────────────────────────────────────────────────────
  // Chained (not sequential statements): Hono accumulates the route schema
  // into the RETURNED app's type. Discarded app.route(...) calls register at
  // runtime but leave AppType as the blank base Hono — silently voiding all
  // hono/client type safety. ReturnType<typeof createApp> must be the chain.
  const app = base
    // Public settings (no auth)
    .route('/api/settings/public', publicSettingsRoutes)

    // Health check (unversioned, infrastructure endpoint)
    .get('/api/health', (c) =>
      c.json({ status: 'ok', timestamp: new Date().toISOString() })
    )
    .route('/api/v1/auth', authRoutes)
    .route('/api/v1/products', productRoutes)
    .route('/api/v1/checkout', checkoutRoutes)
    .route('/api/v1/orders', orderRoutes)
    .route('/api/v1/admin', adminRoutes)
    .route('/api/v1/payments', paymentsRoutes)
    // PUBLIC — no authMiddleware. Gateways call this directly; each provider
    // verifies its own signature inside parseWebhook.
    .route('/api/v1/webhooks', webhooksRoutes)
    // CSP violation sink required by the contentSecurityPolicy reportUri
    // above. Browsers POST JSON reports here; acknowledge and drop (204)
    // so the endpoint never becomes log-spam with a body parser or 404s.
    .post('/api/v1/security/csp-report', (c) => c.body(null, 204))

  // 404 catch-all
  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  return app
}

export type AppType = ReturnType<typeof createApp>
