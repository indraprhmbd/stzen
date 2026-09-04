import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../../shared/db'
import { orders, vaultItems, products } from '../../shared/db/schema'
import { type AuthEnv } from '../../shared/middleware/auth'
import { vaultService } from '../vault/vault.service'
import { NotFoundError, ConflictError } from '../../shared/errors/http'

// ─── Credentials Routes ─────────────────────────────────────────────────────
// Decrypt and return credentials for verified order owner.
// Mounted as sub-route: orderRoutes.route('/:id/credentials', credentialsRoutes)

type CredentialsEnv = AuthEnv

const credentialsRoutes = new Hono<CredentialsEnv>()

// Auth is enforced globally in app.ts.

// GET /:id/credentials — Decrypt vault item for this order
credentialsRoutes.get('/', async (c) => {
  const user = c.get('user')
  const orderId = c.req.param('id')
  if (!orderId) throw new NotFoundError('Order not found')

  // 1. Get order + verify ownership (orderId is public_id)
  const [order] = await db
    .select({
      id: orders.publicId,
      userId: orders.userId,
      status: orders.status,
      vaultItemId: orders.vaultItemId,
      productName: products.name,
      productId: orders.productId,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.publicId, orderId))

  if (!order) {
    throw new NotFoundError('Order not found')
  }

  if (order.userId !== user.sub) {
    throw new NotFoundError('Order not found')
  }

  // 2. Only delivered orders can view credentials
  if (order.status !== 'DELIVERED') {
    throw new ConflictError('Credentials available after delivery')
  }

  if (!order.vaultItemId) {
    throw new ConflictError('No credentials allocated for this order')
  }

  if (!order.productId) {
    throw new NotFoundError('Order not found')
  }

  // 3. Get vault item
  const [vaultItem] = await db
    .select()
    .from(vaultItems)
    .where(eq(vaultItems.id, order.vaultItemId))

  if (!vaultItem) {
    throw new NotFoundError('Credential record not found')
  }

  // 4. Decrypt credential payload
  const credentials = await vaultService.decryptCredential(
    vaultItem.credentialPayload
  )

  // 5. Get product instructions
  const [product] = await db
    .select({ instructions: products.instructions })
    .from(products)
    .where(eq(products.id, order.productId))

  return c.json({
    credentials,
    instructions: product?.instructions ?? null,
    productName: order.productName,
  })
})

export { credentialsRoutes }
