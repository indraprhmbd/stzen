import { supabaseAdmin } from '../../shared/db'
import { getEnv } from '../../shared/lib/runtime-env'
import { getSetting } from '../../shared/lib/settings'
import { SUMOPOD_MIN_AMOUNT_IDR, qrisFee } from '../../shared/lib/payments'
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
  termsAcceptedAt?: string
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

    // S&K consent: enforced only when terms exist (empty body = skip).
    // Consent must postdate the last admin edit, else the buyer agreed to
    // text they never saw. Timestamps compare as epoch millis.
    const termsBody = await getSetting('checkout.terms_body', '')
    if (termsBody.trim()) {
      const accepted = Date.parse(input.termsAcceptedAt ?? '')
      const updated = Date.parse(await getSetting('checkout.terms_updated_at', ''))
      if (!Number.isFinite(accepted) || !Number.isFinite(updated) || accepted < updated) {
        throw new BadRequestError('S&K berubah, setujui ulang sebelum memesan')
      }
    }

    // SumoPod floor: gateway rejects invoices below Rp10.000. Enforced on
    // the DB price, never the client payload. Manual orders have no floor.
    // Fee passthrough (dashboard ON: 0.7%+300) is collected by the gateway
    // on top of base - we invoice base, store base (revenue = net).
    if (paymentMethod === 'sumopod' && Number(variant.price) < SUMOPOD_MIN_AMOUNT_IDR) {
      throw new BadRequestError('QRIS otomatis minimal Rp10.000, gunakan pesanan manual')
    }

    const { data: internal, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('id, product_id, fulfillment_type, allow_backorder, requires_delivery_info')
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)

    let internalId: string
    let internalProductId: string | null = null
    let fulfillmentType: string = 'vault'
    let allowBackorder = false

    if (internal && internal.length > 0) {
      internalId = internal[0]!.id
      internalProductId = internal[0]!.product_id
      fulfillmentType = internal[0]!.fulfillment_type
      allowBackorder = internal[0]!.allow_backorder ?? false
    } else {
      const { data: p, error: pError } = await supabaseAdmin
        .from(PRODUCTS)
        .select('id')
        .eq('public_id', publicId)
        .limit(1)

      if (pError || !p || p.length === 0) throw new NotFoundError('Product not found or unavailable')
      internalId = p[0]!.id
    }

    // Backorder variants stay buyable at zero stock; the flag freezes
    // onto the order so later variant toggles never retro-change it.
    if (fulfillmentType !== 'on_demand' && !allowBackorder) {
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
    if (internal && internal.length > 0 && internal[0]!.requires_delivery_info) {
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
      backorderAllowed: internal ? allowBackorder : false,
      amount: variant.price,
      variantSnapshot: variant,
      paymentProvider: paymentMethod,
      customerAccount,
      waNumber,
    })

    // QRIS charge is base + fee (gateway adds it). Return computed total
    // so the dashboard can show the breakdown without a second round-trip.
    const fee = paymentMethod === 'sumopod' ? qrisFee(Number(variant.price)) : 0
    return {
      orderId: order.id,
      amount: order.amount,
      productName: variant.name,
      ...(fee ? { fee, total: Number(variant.price) + fee } : {}),
    }
  },
}
