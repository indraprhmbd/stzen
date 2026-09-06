import { supabaseAdmin } from '../../shared/db'
import { NotFoundError, ConflictError } from '../../shared/errors/http'
import { appendAudit } from '../../shared/lib/audit'
import {
  importKeyFromBase64,
  encrypt,
  decrypt,
  type EncryptedPayload,
} from '../../shared/lib/crypto'

const VAULT_ITEMS = 'vault_items'
const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'
const ORDERS = 'orders'

let cachedKey: CryptoKey | null = null
async function getKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    const aesSecret = process.env.AES_SECRET_KEY
    if (!aesSecret) throw new Error('AES_SECRET_KEY not configured')
    cachedKey = await importKeyFromBase64(aesSecret)
  }
  return cachedKey!
}

export const vaultService = {
  async importCredentials(variantOrProductId: string, credentialLines: string[]) {
    const { data: variant } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('*')
      .eq('id', variantOrProductId)
      .limit(1)

    let product: any = variant?.[0]
    let isVariant = !!variant && variant.length > 0
    if (!isVariant) {
      const { data: p } = await supabaseAdmin
        .from(PRODUCTS)
        .select('*')
        .eq('id', variantOrProductId)
        .limit(1)

      if (!p || p.length === 0) throw new NotFoundError('Product not found')
      product = p[0]
    }

    const key = await getKey()
    const encryptedItems: Array<any> = []

    for (const line of credentialLines) {
      const payload: EncryptedPayload = await encrypt(key, line)
      if (isVariant) {
        encryptedItems.push({
          variant_id: variantOrProductId,
          product_id: (product as any)?.product_id ?? null,
          credential_payload: JSON.stringify(payload),
          status: 'AVAILABLE',
        })
      } else {
        encryptedItems.push({
          product_id: variantOrProductId,
          credential_payload: JSON.stringify(payload),
          status: 'AVAILABLE',
        })
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .insert(encryptedItems)
      .select()

    if (error) throw new Error(error.message)
    return { imported: inserted?.length || 0, productId: variantOrProductId }
  },

  async decryptCredential(encryptedPayload: string): Promise<string> {
    const key = await getKey()
    const payload: EncryptedPayload = JSON.parse(encryptedPayload)
    return decrypt(key, payload)
  },

  async listByVariant(variantPublicId: string, page: number, orderQuery?: string, sort?: string, sortDir?: string) {
    const limit = 50
    const offset = Math.max(0, page) * limit

    const { data: variants, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('id')
      .eq('public_id', variantPublicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!variants || variants.length === 0) throw new NotFoundError('Variant not found')

    const variantId = variants[0].id

    let query = supabaseAdmin
      .from(VAULT_ITEMS)
      .select(`
        id,
        status,
        created_at,
        allocated_at,
        credential_payload,
        orders (
          public_id,
          status
        )
      `)
      .eq('variant_id', variantId)
      .order('created_at', { ascending: sortDir === 'asc' })

    let rows: any[] = []
    const { data: rangeData, error: rangeError } = await query.range(offset, offset + limit)
    if (rangeError) throw new Error(rangeError.message)
    rows = rangeData || []

    if (orderQuery) {
      const q = orderQuery.toLowerCase()
      rows = rows.filter((r: any) => {
        const order = Array.isArray(r.orders) ? r.orders[0] : (r.orders || {})
        return order?.public_id?.toLowerCase().includes(q)
      })
    }

    const key = await getKey()
    const hasMore = (rows?.length || 0) > limit
    const items = await Promise.all(
      (rows || []).slice(0, limit).map(async (r: any) => {
        const order = Array.isArray(r.orders) ? r.orders[0] : (r.orders || {})
        return {
          id: r.id,
          status: r.status,
          createdAt: r.created_at,
          allocatedAt: r.allocated_at,
          credential: await decrypt(key, JSON.parse(r.credential_payload) as EncryptedPayload),
          orderPublicId: order?.public_id,
          orderStatus: order?.status,
        }
      })
    )

    // Count by status
    const { data: allItems } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('status')
      .eq('variant_id', variantId)

    const byStatus: Record<string, number> = {}
    for (const item of allItems || []) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1
    }

    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)

    return {
      items,
      page,
      hasMore,
      total,
      counts: byStatus,
    }
  },

  async updateCredential(id: string, text: string, actor: { sub: string; email?: string | null }) {
    const { data: item, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*')
      .eq('id', id)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!item || item.length === 0) throw new NotFoundError('Credential not found')
    if (item[0].status !== 'AVAILABLE') throw new ConflictError('Only AVAILABLE credentials can be edited')

    const key = await getKey()
    const payload = await encrypt(key, text)

    const { error: updateError } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .update({ credential_payload: JSON.stringify(payload) })
      .eq('id', id)

    if (updateError) throw new Error(updateError.message)

    await appendAudit({
      action: 'vault:update',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault diperbarui oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return { id }
  },

  async deleteAvailable(id: string, actor: { sub: string; email?: string | null }) {
    const { data: item, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*')
      .eq('id', id)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!item || item.length === 0) throw new NotFoundError('Credential not found')
    if (item[0].status !== 'AVAILABLE') throw new ConflictError('Only AVAILABLE credentials can be deleted')

    const { error: deleteError } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .delete()
      .eq('id', id)

    if (deleteError) throw new Error(deleteError.message)

    await appendAudit({
      action: 'vault:delete',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault dihapus oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return { id }
  },

  async revoke(id: string, actor: { sub: string; email?: string | null }) {
    const { data: item, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*')
      .eq('id', id)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!item || item.length === 0) throw new NotFoundError('Credential not found')
    if (item[0].status !== 'SOLD') throw new ConflictError('Only delivered (SOLD) credentials can be revoked')

    const { error: updateError } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .update({ status: 'REVOKED' })
      .eq('id', id)

    if (updateError) throw new Error(updateError.message)

    await appendAudit({
      action: 'vault:revoke',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault dicabut oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return { id }
  },

  async replace(orderPublicId: string, actor: { sub: string; email?: string | null }) {
    const { data: orderRows, error } = await supabaseAdmin
      .from(ORDERS)
      .select('*')
      .eq('public_id', orderPublicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!orderRows || orderRows.length === 0) throw new NotFoundError('Order not found')

    const order = orderRows[0] as any
    if (order.status !== 'DELIVERED') throw new ConflictError('Only DELIVERED orders can rotate credentials')
    if (!order.vault_item_id) throw new ConflictError('Order has no credential allocated')
    if (!order.variant_id) throw new ConflictError('Order has no variant linked')

    const { data: result, error: rpcError } = await supabaseAdmin.rpc('replace_order_credential', {
      p_variant_id: order.variant_id,
      p_order_id: order.id,
    })

    if (rpcError) throw new Error(rpcError.message)
    if (!result || result.length === 0) throw new ConflictError('STOK_HABIS: no replacement stock for this variant')

    const { oldId, newId } = result[0]

    await appendAudit({
      action: 'order:replace',
      resourceType: 'order',
      resourcePublicId: orderPublicId,
      snapshotText: `Kredensial order diganti oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return { oldId, newId }
  },
}
