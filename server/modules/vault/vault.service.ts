import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '../../shared/db'
import { vaultItems, products, productVariants, orders } from '../../shared/db/schema'
import { NotFoundError, ConflictError } from '../../shared/errors/http'
import { appendAudit } from '../../shared/lib/audit'
import {
  importKeyFromBase64,
  encrypt,
  decrypt,
  type EncryptedPayload,
} from '../../shared/lib/crypto'

// ─── Vault Service ──────────────────────────────────────────────────────────
// Credential import, listing, edit, delete, revoke, replace. Used by admin
// routes. Cached CryptoKey: import once per process, decrypt stays microseconds.

// Cached key — importKeyFromBase64 on every call wastes a subtle.importKey
// per credential. Module scope is per process, key never leaves memory.
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
    // Try variant first
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantOrProductId))
    let product: any = variant
    let isVariant = !!variant
    if (!variant) {
      const [p] = await db.select().from(products).where(eq(products.id, variantOrProductId))
      if (!p) throw new NotFoundError('Product not found')
      product = p
    }

    // Load encryption key (cached)
    const key = await getKey()

    // Encrypt each credential
    const encryptedItems: Array<any> = []

    for (const line of credentialLines) {
      const payload: EncryptedPayload = await encrypt(key, line)
      if (isVariant) {
        encryptedItems.push({
          variantId: variantOrProductId,
          productId: (product as any).productId ?? null,
          credentialPayload: JSON.stringify(payload),
          status: 'AVAILABLE',
        })
      } else {
        encryptedItems.push({
          productId: variantOrProductId,
          credentialPayload: JSON.stringify(payload),
          status: 'AVAILABLE',
        })
      }
    }

    // Bulk insert
    const inserted = await db
      .insert(vaultItems)
      .values(encryptedItems)
      .returning()

    return { imported: inserted.length, productId: variantOrProductId }
  },

  async decryptCredential(encryptedPayload: string): Promise<string> {
    const key = await getKey()
    const payload: EncryptedPayload = JSON.parse(encryptedPayload)
    return decrypt(key, payload)
  },

  // Paginated vault rows for one variant, plaintext included. Caller must
  // enforce the unlock gate. SOLD rows carry their order pointer for rotate.
  async listByVariant(variantPublicId: string, page: number, orderQuery?: string) {
    const limit = 50
    const offset = Math.max(0, page) * limit
    const [variant] = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.publicId, variantPublicId))
    if (!variant) throw new NotFoundError('Variant not found')

    const conditions = [eq(vaultItems.variantId, variant.id)]
    if (orderQuery) {
      conditions.push(sql`${orders.publicId} ilike ${orderQuery + '%'}`)
    }
    const rows = await db
      .select({
        id: vaultItems.id,
        status: vaultItems.status,
        createdAt: vaultItems.createdAt,
        allocatedAt: vaultItems.allocatedAt,
        payload: vaultItems.credentialPayload,
        orderPublicId: orders.publicId,
        orderStatus: orders.status,
      })
      .from(vaultItems)
      .leftJoin(orders, eq(orders.vaultItemId, vaultItems.id))
      .where(and(...conditions))
      .orderBy(desc(vaultItems.createdAt))
      .limit(limit + 1)
      .offset(offset)

    const key = await getKey()
    const hasMore = rows.length > limit
    const items = await Promise.all(
      rows.slice(0, limit).map(async (r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        allocatedAt: r.allocatedAt,
        credential: await decrypt(key, JSON.parse(r.payload) as EncryptedPayload),
        orderPublicId: r.orderPublicId,
        orderStatus: r.orderStatus,
      }))
    )

    // Single query replaces the redundant count + byStatus pair
    const byStatus = await db
      .select({ status: vaultItems.status, count: sql<number>`cast(count(*) as int)` })
      .from(vaultItems)
      .where(eq(vaultItems.variantId, variant.id))
      .groupBy(vaultItems.status)

    const total = byStatus.reduce((sum, r) => sum + r.count, 0)

    return {
      items,
      page,
      hasMore,
      total,
      counts: Object.fromEntries(byStatus.map((s) => [s.status, s.count])),
    }
  },

  // In place edit: re-encrypt overwrite. AVAILABLE only, history rows are
  // immutable (fix delivered creds via replace, not edit).
  async updateCredential(id: string, text: string, actor: { sub: string; email?: string | null }) {
    const [item] = await db.select().from(vaultItems).where(eq(vaultItems.id, id))
    if (!item) throw new NotFoundError('Credential not found')
    if (item.status !== 'AVAILABLE') throw new ConflictError('Only AVAILABLE credentials can be edited')
    const key = await getKey()
    const payload = await encrypt(key, text)
    await db.update(vaultItems).set({ credentialPayload: JSON.stringify(payload) }).where(eq(vaultItems.id, id))
    await appendAudit({
      action: 'vault:update',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault diperbarui oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
    }).catch(() => {})
    return { id }
  },

  // Hard delete AVAILABLE rows only. SOLD belongs to buyer history, REVOKED
  // belongs to the incident trail.
  async deleteAvailable(id: string, actor: { sub: string; email?: string | null }) {
    const [item] = await db.select().from(vaultItems).where(eq(vaultItems.id, id))
    if (!item) throw new NotFoundError('Credential not found')
    if (item.status !== 'AVAILABLE') throw new ConflictError('Only AVAILABLE credentials can be deleted')
    await db.delete(vaultItems).where(eq(vaultItems.id, id))
    await appendAudit({
      action: 'vault:delete',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault dihapus oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
    }).catch(() => {})
    return { id }
  },

  // Revoke without replacement (empty stock path). Buyer route 409s on
  // REVOKED with a contact admin message.
  async revoke(id: string, actor: { sub: string; email?: string | null }) {
    const [item] = await db.select().from(vaultItems).where(eq(vaultItems.id, id))
    if (!item) throw new NotFoundError('Credential not found')
    if (item.status !== 'SOLD') throw new ConflictError('Only delivered (SOLD) credentials can be revoked')
    await db.update(vaultItems).set({ status: 'REVOKED' }).where(eq(vaultItems.id, id))
    await appendAudit({
      action: 'vault:revoke',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault dicabut oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
    }).catch(() => {})
    return { id }
  },

  // Rotate: revoke the delivered cred and point the order at the next
  // AVAILABLE item. One transaction: empty stock rolls back the revoke, so
  // the buyer never lands on a dead pointer. Order stays DELIVERED, buyer
  // sees the new cred on the same card.
  async replace(orderPublicId: string, actor: { sub: string; email?: string | null }) {
    const [order] = await db.select().from(orders).where(eq(orders.publicId, orderPublicId))
    if (!order) throw new NotFoundError('Order not found')
    if (order.status !== 'DELIVERED') throw new ConflictError('Only DELIVERED orders can rotate credentials')
    if (!order.vaultItemId) throw new ConflictError('Order has no credential allocated')
    if (!order.variantId) throw new ConflictError('Order has no variant linked')

    const result = await db.transaction(async (tx) => {
      await tx.update(vaultItems).set({ status: 'REVOKED' }).where(eq(vaultItems.id, order.vaultItemId!))
      const picked = (await tx.execute(sql`
        select id from vault_items
        where variant_id = ${order.variantId}::uuid and status = 'AVAILABLE'
        order by created_at asc limit 1 for update skip locked
      `)) as unknown as any
      const row = Array.isArray(picked) ? picked[0] : picked?.rows?.[0]
      if (!row) throw new ConflictError('STOK_HABIS: no replacement stock for this variant')
      await tx.update(vaultItems).set({ status: 'SOLD', allocatedAt: new Date() }).where(eq(vaultItems.id, row.id))
      await tx.update(orders).set({ vaultItemId: row.id }).where(eq(orders.id, order.id))
      return { oldId: order.vaultItemId, newId: row.id as string }
    })

    await appendAudit({
      action: 'order:replace',
      resourceType: 'order',
      resourcePublicId: orderPublicId,
      snapshotText: `Kredensial order diganti oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
    }).catch(() => {})
    return result
  },
}
