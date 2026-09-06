import { supabaseAdmin } from '../../shared/db'
import { productsService } from '../products/products.service'
import { ordersService } from '../orders/orders.service'
import { getStockCount } from '../../shared/lib/db-helpers'
import { NotFoundError, ConflictError } from '../../shared/errors/http'

const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'

export const checkoutService = {
  async createOrder(userId: string, publicId: string) {
    let variant: any
    try {
      variant = await productsService.getById(publicId)
    } catch {
      throw new NotFoundError('Product not found or unavailable')
    }

    if (!variant.isActive) {
      throw new NotFoundError('Product not found or unavailable')
    }

    const { data: internal, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('id, product_id, fulfillment_type')
      .eq('public_id', publicId)
      .limit(1)

    let internalId: string
    let internalProductId: string | null = null
    let fulfillmentType: string = 'vault'

    if (internal && internal.length > 0) {
      internalId = internal[0].id
      internalProductId = internal[0].product_id
      fulfillmentType = internal[0].fulfillment_type
    } else {
      const { data: p, error: pError } = await supabaseAdmin
        .from(PRODUCTS)
        .select('id')
        .eq('public_id', publicId)
        .limit(1)

      if (pError || !p || p.length === 0) throw new NotFoundError('Product not found or unavailable')
      internalId = p[0].id
    }

    if (fulfillmentType !== 'on_demand') {
      const stock = await getStockCount(internalId)
      if (stock === 0) {
        throw new ConflictError('Out of stock')
      }
    }

    const order = await ordersService.create({
      userId,
      productId: internalProductId,
      variantId: internal ? internalId : undefined,
      amount: variant.price,
      variantSnapshot: variant,
    })

    return {
      orderId: order.id,
      amount: order.amount,
      productName: variant.name,
    }
  },
}
