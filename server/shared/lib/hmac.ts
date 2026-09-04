// ─── HMAC-SHA256 Utilities ───────────────────────────────────────────────────
// Uses Web Crypto API only (crypto.subtle). No node:crypto imports.
// Used to verify payment gateway webhook signatures (SumoPod Svix-style HMAC,
// Duitku callback signature). Keep this Web-Crypto-only per repo convention —
// see docs/payments-scaffold-2026-09-04.md for why Duitku's *invoice* signing
// (MD5) needs a separate vendored helper instead of living here.

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await importHmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toHex(sig)
}

export async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const key = await importHmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toBase64(sig)
}

// Constant-time string comparison — avoids leaking match length via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function verifyHmacSha256Hex(secret: string, payload: string, signatureHex: string): Promise<boolean> {
  const expected = await hmacSha256Hex(secret, payload)
  return timingSafeEqual(expected, signatureHex.toLowerCase())
}

export async function verifyHmacSha256Base64(secret: string, payload: string, signatureBase64: string): Promise<boolean> {
  const expected = await hmacSha256Base64(secret, payload)
  return timingSafeEqual(expected, signatureBase64)
}
