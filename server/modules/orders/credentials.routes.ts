import { Hono } from 'hono'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { vaultService } from '../vault/vault.service'
import { NotFoundError, ConflictError } from '../../shared/errors/http'

const ORDERS = 'orders'
const PRODUCTS = 'products'
const VAULT_ITEMS = 'vault_items'

type CredentialsEnv = AuthEnv

const credentialsRoutes = new Hono<CredentialsEnv>()
  .get('/', async (c) => {
    const user = c.get('user')
    const orderId = c.req.param('id')
    if (!orderId) throw new NotFoundError('Order not found')

    const { data: orders, error } = await supabaseAdmin
      .from(ORDERS)
      .select(`
        *,
        ${PRODUCTS} (
          id,
          name,
          instructions
        )
      `)
      .eq('public_id', orderId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!orders || orders.length === 0) throw new NotFoundError('Order not found')

    const order = orders[0] as any

    if (order.user_id !== user.sub) {
      throw new NotFoundError('Order not found')
    }

    if (order.status !== 'DELIVERED') {
      throw new ConflictError('Credentials available after delivery')
    }

    if (!order.vault_item_id) {
      throw new ConflictError('No credentials allocated for this order')
    }

    if (!order.product_id) {
      throw new NotFoundError('Order not found')
    }

    const { data: vaultItems, error: vaultError } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*')
      .eq('id', order.vault_item_id)
      .limit(1)

    if (vaultError) throw new Error(vaultError.message)
    if (!vaultItems || vaultItems.length === 0) {
      throw new NotFoundError('Credential record not found')
    }

    const vaultItem = vaultItems[0] as any

    if (vaultItem.status === 'REVOKED') {
      throw new ConflictError('Kredensial ini dicabut karena laporan kendala, hubungi admin untuk penggantian')
    }

    const product = Array.isArray(order.products) ? order.products[0] : (order.products || {})

    const credentials = await vaultService.decryptCredential(vaultItem.credential_payload)

    return c.json({
      credentials,
      instructions: product?.instructions ?? null,
      productName: order.variant_name_snapshot ?? order.base_name_snapshot ?? product?.name ?? 'Produk',
    })
  })

export { credentialsRoutes }
