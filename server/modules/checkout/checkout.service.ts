import { productsService } from '../products/products.service'
import { ordersService } from '../orders/orders.service'
import { getStockCount } from '../../shared/lib/db-helpers'
import { NotFoundError, ConflictError } from '../../shared/errors/http'

// ─── Checkout Service ───────────────────────────────────────────────────────
// Orchestrates order creation: product check + stock check + insert.

export const checkoutService = {
  async createOrder(userId: string, productId: string) {
    // 1. Check product exists and is active
    let product
    try {
      product = await productsService.getById(productId)
    } catch {
      throw new NotFoundError('Product not found or unavailable')
    }

    if (!product.isActive) {
      throw new NotFoundError('Product not found or unavailable')
    }

    // 2. Check stock > 0
    const stock = await getStockCount(productId)
    if (stock === 0) {
      throw new ConflictError('Out of stock')
    }

    // 3. Create order
    const order = await ordersService.create({
      userId,
      productId,
      amount: product.price,
    })

    return {
      orderId: order.id,
      amount: order.amount,
      productName: product.name,
    }
  },
}
