import { eq } from 'drizzle-orm'
import { db } from '../../shared/db'
import { vaultItems, products } from '../../shared/db/schema'
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
  async importCredentials(productId: string, credentialLines: string[]) {
    // Verify product exists
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))

    if (!product) {
      throw new NotFoundError('Product not found')
    }

    // Load encryption key
    const aesSecret = process.env.AES_SECRET_KEY
    if (!aesSecret) {
      throw new Error('AES_SECRET_KEY not configured')
    }
    const key = await importKeyFromBase64(aesSecret)

    // Encrypt each credential
    const encryptedItems: Array<{
      productId: string
      credentialPayload: string
      status: 'AVAILABLE'
    }> = []

    for (const line of credentialLines) {
      const payload: EncryptedPayload = await encrypt(key, line)
      encryptedItems.push({
        productId,
        credentialPayload: JSON.stringify(payload),
        status: 'AVAILABLE',
      })
    }

    // Bulk insert
    const inserted = await db
      .insert(vaultItems)
      .values(encryptedItems)
      .returning()

    return { imported: inserted.length, productId }
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
