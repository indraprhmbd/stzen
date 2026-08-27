import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { products, orders, vaultItems } from '../db/schema'
import { authMiddleware, type AuthEnv } from '../middleware/auth'
import { CheckoutSchema } from '../lib/schemas'

// ─── Types ──────────────────────────────────────────────────────────────────

type CheckoutEnv = AuthEnv

// ─── Checkout Routes ────────────────────────────────────────────────────────

const checkoutRoutes = new Hono<CheckoutEnv>()

// ─── Auth required for all checkout routes ───────────────────────────────────

checkoutRoutes.use('*', authMiddleware)

// ─── POST /checkout ─────────────────────────────────────────────────────────
// Create a new order. Stock is checked but not reserved.
// Admin manually approves payment and sends credentials.

checkoutRoutes.post(
  '/',
  zValidator('json', CheckoutSchema),
  async (c) => {
    const user = c.get('user')
    const { productId } = c.req.valid('json')

    // 1. Check product exists and is active
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.isActive, true)))

    if (!product) {
      return c.json({ error: 'Product not found or unavailable' }, 404)
    }

    // 2. Check stock > 0
    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(vaultItems)
      .where(
        and(
          eq(vaultItems.productId, productId),
          eq(vaultItems.status, 'AVAILABLE')
        )
      )

    if (count === 0) {
      return c.json({ error: 'Out of stock' }, 409)
    }

    // 3. Create order
    const [order] = await db
      .insert(orders)
      .values({
        userId: user.sub,
        productId,
        status: 'PENDING',
        amount: product.price,
      })
      .returning()

    return c.json({
      orderId: order.id,
      amount: order.amount,
      productName: product.name,
    }, 201)
  }
)

export default checkoutRoutes
