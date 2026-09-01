import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { products } from '../../shared/db/schema'
import { productsService } from '../products/products.service'
import { ordersService } from '../orders/orders.service'
import { getStockCount } from '../../shared/lib/db-helpers'
import { NotFoundError, ConflictError } from '../../shared/errors/http'

// ─── Checkout Service ───────────────────────────────────────────────────────
// Orchestrates order creation: product check + stock check + insert.

export const checkoutService = {
  async createOrder(userId: string, publicId: string) {
    // 1. Check product exists and is active (publicId)
    let product: any
    try {
      product = await productsService.getById(publicId)
    } catch {
      throw new NotFoundError('Product not found or unavailable')
    }

    if (!product.isActive) {
      throw new NotFoundError('Product not found or unavailable')
    }

    // Resolve internal id for stock and order
    const [internal] = await db.select({ id: products.id }).from(products).where(eq(products.publicId, publicId))
    if (!internal) throw new NotFoundError('Product not found or unavailable')
    const internalId = internal.id

    // 2. Check stock > 0
    const stock = await getStockCount(internalId)
    if (stock === 0) {
      throw new ConflictError('Out of stock')
    }

    // 3. Create order (needs internal productId)
    const order = await ordersService.create({
      userId,
      productId: internalId,
      amount: product.price,
    })

    return {
      orderId: order.id,
      amount: order.amount,
      productName: product.name,
    }
  },
}
