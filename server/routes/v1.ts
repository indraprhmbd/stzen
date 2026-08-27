import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth'
import adminRoutes from './admin'
import productRoutes from './products'
import orderRoutes from './orders'
import checkoutRoutes from './checkout'

// ─── V1 Router ──────────────────────────────────────────────────────────────
// All v1 API routes are mounted here. The main app mounts this at /api/v1.
//
// Structure:
//   /api/v1/me          - authenticated user profile
//   /api/v1/admin/*     - admin product CRUD + stock management + order mgmt
//   /api/v1/products/*  - public storefront catalog
//   /api/v1/orders/*    - customer order dashboard
//   /api/v1/checkout/*  - order creation

type V1Env = AuthEnv

const v1 = new Hono<V1Env>()

// ─── Authenticated User ─────────────────────────────────────────────────────

v1.get('/me', authMiddleware, (c) => {
  const user = c.get('user')
  return c.json({
    id: user.sub,
    email: user.email,
    role: user.role,
  })
})

// ─── Public Routes ──────────────────────────────────────────────────────────

v1.route('/products', productRoutes)

// ─── Authenticated User Routes ──────────────────────────────────────────────

v1.route('/checkout', checkoutRoutes)
v1.route('/orders', orderRoutes)

// ─── Admin Routes ───────────────────────────────────────────────────────────
// Auth + role guard applied inside admin.ts

v1.route('/admin', adminRoutes)

export default v1
