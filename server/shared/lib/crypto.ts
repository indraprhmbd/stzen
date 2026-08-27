// ─── AES-256-GCM Encryption Utilities ───────────────────────────────────────
// Uses Web Crypto API only (crypto.subtle). No node:crypto imports.
// Works identically in Node.js 19+, browsers, and edge runtimes.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ─── Base64 Helpers ─────────────────────────────────────────────────────────

function base64Encode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ─── Key Import ─────────────────────────────────────────────────────────────

export async function importKeyFromBase64(secret: string): Promise<CryptoKey> {
  const keyData = base64Decode(secret)

  if (keyData.byteLength !== 32) {
    throw new Error(`AES-256-GCM requires a 32-byte (256-bit) key. Got ${keyData.byteLength} bytes.`)
  }

  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

// ─── Encrypt ────────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  iv: string   // base64url-encoded IV
  data: string // base64url-encoded ciphertext + auth tag
}

export async function encrypt(
  key: CryptoKey,
  plaintext: string
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )

  return {
    iv: base64Encode(iv),
    data: base64Encode(ciphertext),
  }
}

// ─── Decrypt ────────────────────────────────────────────────────────────────

export async function decrypt(
  key: CryptoKey,
  payload: EncryptedPayload
): Promise<string> {
  const iv = base64Decode(payload.iv)
  const ciphertext = base64Decode(payload.data)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  return decoder.decode(decrypted)
}
