import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { products, productVariants } from '../../shared/db/schema'
import { productsService } from '../products/products.service'
import { ordersService } from '../orders/orders.service'
import { getStockCount } from '../../shared/lib/db-helpers'
import { NotFoundError, ConflictError } from '../../shared/errors/http'

// ─── Checkout Service ───────────────────────────────────────────────────────
// Orchestrates order creation: product check + stock check + insert.

export const checkoutService = {
  async createOrder(userId: string, publicId: string) {
    // 1. Check variant exists and is active (publicId is variant)
    let variant: any
    try {
      variant = await productsService.getById(publicId)
    } catch {
      throw new NotFoundError('Product not found or unavailable')
    }

    if (!variant.isActive) {
      throw new NotFoundError('Product not found or unavailable')
    }

    // Resolve internal variant id
    const [internal] = await db.select({ id: productVariants.id, productId: productVariants.productId, fulfillmentType: productVariants.fulfillmentType }).from(productVariants).where(eq(productVariants.publicId, publicId))
    // fallback legacy product
    let internalId: string
    let internalProductId: string | null = null
    let fulfillmentType: string = 'vault'
    if (internal) {
      internalId = internal.id
      internalProductId = internal.productId
      fulfillmentType = internal.fulfillmentType
    } else {
      const [p] = await db.select({ id: products.id }).from(products).where(eq(products.publicId, publicId))
      if (!p) throw new NotFoundError('Product not found or unavailable')
      internalId = p.id
    }

    // 2. Check stock > 0 per variant (skip for on_demand)
    if (fulfillmentType !== 'on_demand') {
      const stock = await getStockCount(internalId)
      if (stock === 0) {
        throw new ConflictError('Out of stock')
      }
    }

    // 3. Create order with variant snapshot
    const order = await ordersService.create({
      userId,
      productId: internalProductId as any,
      variantId: internal ? internalId : undefined,
      amount: variant.price,
      variantSnapshot: variant,
    } as any)

    return {
      orderId: order.id,
      amount: order.amount,
      productName: variant.name,
    }
  },
}
