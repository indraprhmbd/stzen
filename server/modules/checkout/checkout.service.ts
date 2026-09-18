import { supabaseAdmin } from '../../shared/db'
import { getEnv } from '../../shared/lib/runtime-env'
import { normalizeWaNumber } from '../../shared/lib/wa'
import { productsService } from '../products/products.service'
import { ordersService } from '../orders/orders.service'
import { getStockCount } from '../../shared/lib/db-helpers'
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/http'

const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'

export interface CheckoutInput {
  paymentMethod: 'manual' | 'sumopod'
  customerAccount?: string
  waNumber?: string
}

export const checkoutService = {
  async createOrder(userId: string, publicId: string, input: CheckoutInput) {
    const { paymentMethod } = input
    // Fail closed: sumopod only when its key is configured. Manual always.
    if (paymentMethod === 'sumopod' && !getEnv('PAYMENT_SUMOPOD_API_KEY')) {
      throw new BadRequestError('Metode pembayaran tidak tersedia')
    }
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
      .select('id, product_id, fulfillment_type, requires_delivery_info')
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

    // Delivery contact: required iff the variant's flag is on (read from the
    // DB row above, never trusted from the client). Flag off: ignore and
    // store blanks so unflagged variants keep the lean dialog.
    let customerAccount = ''
    let waNumber = ''
    if (internal && internal.length > 0 && internal[0].requires_delivery_info) {
      const account = (input.customerAccount ?? '').trim()
      if (account.length < 3 || account.length > 120) {
        throw new BadRequestError('Akun tujuan wajib diisi (3-120 karakter)')
      }
      const wa = normalizeWaNumber(input.waNumber ?? '')
      if (!wa) {
        throw new BadRequestError('Nomor WA tidak valid (format 08..)')
      }
      customerAccount = account
      waNumber = wa
    }

    const order = await ordersService.create({
      userId,
      productId: internalProductId,
      variantId: internal ? internalId : undefined,
      amount: variant.price,
      variantSnapshot: variant,
      paymentProvider: paymentMethod,
      customerAccount,
      waNumber,
    })

    return {
      orderId: order.id,
      amount: order.amount,
      productName: variant.name,
    }
  },
}
