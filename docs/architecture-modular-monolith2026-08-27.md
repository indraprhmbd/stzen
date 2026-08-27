# Server Architecture: Modular Monolith

## Context

Current codebase uses flat layered architecture with business logic embedded in route handlers. Order state machine is scattered across 3 handlers. Stock counting duplicated 3 places. One giant schemas.ts and schema.ts for all features. No service layer.

Refactor to modular monolith: feature-based modules with service layer, centralized error handling, shared kernel.

---

## Target Structure

```
server/
  index.ts                              # Entrypoint: just createApp + serve

  app.ts                                # createApp(): compose all modules, export AppType

  shared/
    db/
      index.ts                          # Drizzle client singleton
      schema.ts                         # Re-exports all table schemas from modules
    middleware/
      auth.ts                           # JWT verification via Supabase JWKS
      require-role.ts                   # Role guard (reusable: requireRole('admin'))
    errors/
      http.ts                           # NotFoundError, ForbiddenError, ConflictError, etc.
      handler.ts                        # Global app.onError()
    lib/
      crypto.ts                         # AES-256-GCM encrypt/decrypt
      db-helpers.ts                     # getStockCount(productId), shared DB queries

  modules/
    products/
      products.routes.ts                # GET /, GET /:id (public)
      products.service.ts               # listActive, getById, getStockCount
      products.schema.ts                # ProductCreateSchema, ProductUpdateSchema, BulkStockSchema
      products.types.ts                 # Product, ProductWithStock types
      index.ts                          # Public API: re-exports routes + service

    orders/
      orders.routes.ts                  # GET /, GET /:id (auth user)
      orders.service.ts                 # listByUser, getById, create, transitionStatus
      orders.schema.ts                  # (empty for now, CheckoutSchema lives in checkout module)
      orders.types.ts                   # Order, OrderStatus, OrderAction types
      index.ts                          # Public API

    checkout/
      checkout.routes.ts                # POST / (auth)
      checkout.service.ts               # createOrder (product check + stock check + insert)
      checkout.schema.ts                # CheckoutSchema
      index.ts                          # Public API

    vault/
      vault.service.ts                  # importCredentials, decryptCredential
      vault.types.ts                    # VaultItem, EncryptedPayload types
      index.ts                          # Public API

    admin/
      admin.routes.ts                   # Composes admin sub-routes
      admin.orders.routes.ts            # GET /orders, POST /orders/:id/approve|reject|deliver
      admin.products.routes.ts          # CRUD + stock import
      index.ts                          # Public API
```

---

## Shared Kernel

### shared/db/index.ts

Drizzle client singleton. Connects via Supabase Transaction Pooler (port 6543).

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })
```

### shared/db/schema.ts

Re-exports all table schemas. Single source of truth for Drizzle.

```typescript
export { profiles } from '../../modules/products/products.types'
// Or: import all table definitions and re-export
```

Actually simpler: keep schema.ts in shared/db/ with all table definitions. Modules import from shared.

### shared/middleware/auth.ts

JWT verification. Sets `user` on context with `{ sub, email, role }`.

### shared/middleware/require-role.ts

Reusable role guard:

```typescript
import { createMiddleware } from 'hono/factory'

export function requireRole(...roles: string[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions')
    }
    await next()
  })
}
```

Usage: `adminRoutes.use('*', requireRole('admin'))`

### shared/errors/http.ts

```typescript
export class AppError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') { super(message, 404) }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403) }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') { super(message, 409) }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') { super(message, 400) }
}
```

### shared/errors/handler.ts

```typescript
import type { ErrorHandler } from 'hono'
import { AppError } from './http'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status as any)
  }
  console.error('[server] unhandled:', err)
  return c.json({ error: 'Internal server error' }, 500)
}
```

### shared/lib/crypto.ts

Move from server/utils/crypto.ts. No changes.

### shared/lib/db-helpers.ts

```typescript
import { sql, eq, and } from 'drizzle-orm'
import { db } from '../db'
import { vaultItems } from '../db/schema'

export async function getStockCount(productId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(vaultItems)
    .where(and(
      eq(vaultItems.productId, productId),
      eq(vaultItems.status, 'AVAILABLE')
    ))
  return count
}
```

---

## Module Pattern

Each module follows:

```
module/
  module.routes.ts     # Hono sub-app with HTTP handlers
  module.service.ts    # Business logic (DB queries + rules)
  module.schema.ts     # Zod validation schemas
  module.types.ts      # TypeScript types (exported for other modules)
  index.ts             # Re-exports routes + service
```

### Module Index Pattern

```typescript
// modules/products/index.ts
export { productRoutes as routes } from './products.routes'
export { productsService as service } from './products.service'
export type { Product, ProductWithStock } from './products.types'
```

### Route Handler Pattern

```typescript
// Thin handler, delegates to service
productRoutes.get('/', async (c) => {
  const category = c.req.query('category')
  const products = await productsService.listActive(category)
  return c.json(products)
})
```

### Service Pattern

```typescript
// Business logic, testable without HTTP
export const productsService = {
  async listActive(category?: string) { ... },
  async getById(id: string) { ... },
}
```

---

## Module Details

### Products Module

**routes.ts:**
- `GET /` - Public catalog with stock counts
- `GET /:id` - Single product detail

**service.ts:**
- `listActive(category?)` - Active products with $count subquery
- `getById(id)` - Single product with stock count

**schema.ts:**
- `ProductCreateSchema`
- `ProductUpdateSchema`
- `BulkStockSchema`

### Orders Module

**routes.ts:**
- `GET /` - User's orders (auth)
- `GET /:id` - Order detail + ownership check (auth)

**service.ts:**
- `listByUser(userId)` - User's orders with product join
- `getById(id, userId?)` - Order detail, optional ownership check
- `create(data)` - Create PENDING order
- `transitionStatus(orderId, action)` - Centralized state machine

**State machine:**
```
PENDING  -> PAID (approve), REJECTED (reject)
PAID     -> DELIVERED (deliver)
REJECTED -> (terminal)
DELIVERED -> (terminal)
REFUNDED -> (terminal)
```

### Checkout Module

**routes.ts:**
- `POST /` - Create order (auth)

**service.ts:**
- `createOrder(userId, productId)` - Product check + stock check + create order

### Vault Module

**service.ts:**
- `importCredentials(productId, credentialLines)` - Encrypt + bulk insert
- `decryptCredential(encryptedPayload)` - Decrypt for admin viewing

### Admin Module

**admin.routes.ts** - Composes sub-routes:
- `GET /orders` - List all orders with filters
- `POST /orders/:id/approve` - transitionStatus('approve')
- `POST /orders/:id/reject` - transitionStatus('reject')
- `POST /orders/:id/deliver` - transitionStatus('deliver')

**admin.products.routes.ts** - Mounts products CRUD:
- `GET /products` - List all with stock counts
- `POST /products` - Create product
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product
- `POST /products/:id/stock` - Bulk import credentials

---

## App Composition

```typescript
// server/app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { errorHandler } from './shared/errors/handler'
import { productRoutes } from './modules/products'
import { orderRoutes } from './modules/orders'
import { checkoutRoutes } from './modules/checkout'
import { adminRoutes } from './modules/admin'

export function createApp() {
  const app = new Hono()

  // Global middleware
  app.use('*', logger())
  app.use('*', secureHeaders())
  app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }))

  // Global error handler
  app.onError(errorHandler)

  // Health check (unversioned)
  app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // API v1
  app.route('/api/v1/products', productRoutes)
  app.route('/api/v1/checkout', checkoutRoutes)
  app.route('/api/v1/orders', orderRoutes)
  app.route('/api/v1/admin', adminRoutes)

  // 404
  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  return app
}

export type AppType = ReturnType<typeof createApp>
```

```typescript
// server/index.ts
import { serve } from '@hono/node-server'
import { createApp } from './app'

const app = createApp()
const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port })
console.log(`[server] running on http://localhost:${port}`)
```

---

## Files to Create

| File | Action |
|---|---|
| server/app.ts | Create |
| server/shared/db/index.ts | Move from server/db/index.ts |
| server/shared/db/schema.ts | Move from server/db/schema.ts |
| server/shared/middleware/auth.ts | Move from server/middleware/auth.ts |
| server/shared/middleware/require-role.ts | Create |
| server/shared/errors/http.ts | Create |
| server/shared/errors/handler.ts | Create |
| server/shared/lib/crypto.ts | Move from server/utils/crypto.ts |
| server/shared/lib/db-helpers.ts | Create |
| server/modules/products/products.routes.ts | Refactor from server/routes/products.ts |
| server/modules/products/products.service.ts | Create (extract from routes) |
| server/modules/products/products.schema.ts | Move from server/lib/schemas.ts (product schemas) |
| server/modules/products/products.types.ts | Create |
| server/modules/products/index.ts | Create |
| server/modules/orders/orders.routes.ts | Refactor from server/routes/orders.ts |
| server/modules/orders/orders.service.ts | Create (extract from routes) |
| server/modules/orders/orders.schema.ts | Create (empty placeholder) |
| server/modules/orders/orders.types.ts | Create |
| server/modules/orders/index.ts | Create |
| server/modules/checkout/checkout.routes.ts | Refactor from server/routes/checkout.ts |
| server/modules/checkout/checkout.service.ts | Create (extract from routes) |
| server/modules/checkout/checkout.schema.ts | Move from server/lib/schemas.ts (CheckoutSchema) |
| server/modules/checkout/index.ts | Create |
| server/modules/vault/vault.service.ts | Refactor from server/routes/admin.ts (stock import) |
| server/modules/vault/vault.types.ts | Create |
| server/modules/vault/index.ts | Create |
| server/modules/admin/admin.routes.ts | Create (composes sub-routes) |
| server/modules/admin/admin.orders.routes.ts | Refactor from server/routes/admin.ts (order mgmt) |
| server/modules/admin/admin.products.routes.ts | Refactor from server/routes/admin.ts (product CRUD) |
| server/modules/admin/index.ts | Create |

## Files to Delete (after migration)

| File | Reason |
|---|---|
| server/routes/v1.ts | Replaced by app.ts composition |
| server/routes/admin.ts | Split into admin module |
| server/routes/products.ts | Moved to products module |
| server/routes/checkout.ts | Moved to checkout module |
| server/routes/orders.ts | Moved to orders module |
| server/lib/schemas.ts | Split into per-module schemas |
| server/utils/crypto.ts | Moved to shared/lib/crypto.ts |
| server/middleware/auth.ts | Moved to shared/middleware/auth.ts |
| server/db/index.ts | Moved to shared/db/index.ts |
| server/db/schema.ts | Moved to shared/db/schema.ts |

## Client Update

| File | Change |
|---|---|
| client/src/lib/api.ts | Import AppType from '../../../server/app' instead of server/index |

---

## Migration Order

1. Create shared kernel (db, middleware, errors, lib)
2. Create products module (simplest, no auth)
3. Create vault module (encryption logic)
4. Create orders module (auth, state machine)
5. Create checkout module (depends on products + orders)
6. Create admin module (composes sub-routes)
7. Create app.ts + refactor index.ts
8. Update client api.ts import
9. Delete old flat files
10. Verify build
