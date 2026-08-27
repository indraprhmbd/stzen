import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { errorHandler } from './shared/errors/handler'
import { routes as productRoutes } from './modules/products'
import { routes as orderRoutes } from './modules/orders'
import { routes as checkoutRoutes } from './modules/checkout'
import { routes as adminRoutes } from './modules/admin'

// ─── App Factory ────────────────────────────────────────────────────────────
// Creates the Hono app with all modules composed.
// Export AppType for end-to-end type safety with hono/client.

export function createApp() {
  const app = new Hono()

  // Global middleware
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

  // Global error handler
  app.onError(errorHandler)

  // Health check (unversioned, infrastructure endpoint)
  app.get('/api/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() })
  )

  // ─── API v1 ─────────────────────────────────────────────────────────────
  app.route('/api/v1/products', productRoutes)
  app.route('/api/v1/checkout', checkoutRoutes)
  app.route('/api/v1/orders', orderRoutes)
  app.route('/api/v1/admin', adminRoutes)

  // 404 catch-all
  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  return app
}

export type AppType = ReturnType<typeof createApp>
