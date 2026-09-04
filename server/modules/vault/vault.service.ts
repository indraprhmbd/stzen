import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { vaultItems, products, productVariants } from '../../shared/db/schema'
import { NotFoundError } from '../../shared/errors/http'
import {
  importKeyFromBase64,
  encrypt,
  decrypt,
  type EncryptedPayload,
} from '../../shared/lib/crypto'

// ─── Vault Service ──────────────────────────────────────────────────────────
// Credential import and decryption. Used by admin routes.

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

    // Load encryption key
    const aesSecret = process.env.AES_SECRET_KEY
    if (!aesSecret) {
      throw new Error('AES_SECRET_KEY not configured')
    }
    const key = await importKeyFromBase64(aesSecret)

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
    const aesSecret = process.env.AES_SECRET_KEY
    if (!aesSecret) {
      throw new Error('AES_SECRET_KEY not configured')
    }
    const key = await importKeyFromBase64(aesSecret)
    const payload: EncryptedPayload = JSON.parse(encryptedPayload)
    return decrypt(key, payload)
  },
}
