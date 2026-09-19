// ─── HMAC-SHA256 Utilities ───────────────────────────────────────────────────
// Uses Web Crypto API only (crypto.subtle). No node:crypto imports.
// Used to verify payment gateway webhook signatures (SumoPod Svix-style HMAC,
// Duitku callback signature). Keep this Web-Crypto-only per repo convention -
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
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
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

// Constant-time string comparison - avoids leaking match length via timing.
export function timingSafeEqual(a: string, b: string): boolean {
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

// ─── Svix-style Webhook Verification (SumoPod) ──────────────────────────────
// signed = `${id}.${timestamp}.${rawBody}`, key = base64-decoded whsec_ body,
// signature header holds space-separated `v1,<base64>` entries. Timestamps
// older/newer than toleranceSec are rejected (replay / clock-skew guard).
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacWithKeyBytes(keyBytes: Uint8Array, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toBase64(sig)
}

export async function verifySvixSignature(opts: {
  secret: string
  rawBody: string
  id: string | null | undefined
  timestamp: string | null | undefined
  signatureHeader: string | null | undefined
  toleranceSec?: number
}): Promise<boolean> {
  const { secret, rawBody, id, timestamp, signatureHeader } = opts
  if (!secret || !rawBody || !id || !timestamp || !signatureHeader) return false
  const ts = Number(timestamp)
  if (!Number.isInteger(ts)) return false
  const tolerance = opts.toleranceSec ?? 300
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > tolerance) return false

  const keyBytes = base64ToBytes(secret.startsWith('whsec_') ? secret.slice(6) : secret)
  const expected = await hmacWithKeyBytes(keyBytes, `${id}.${timestamp}.${rawBody}`)
  return signatureHeader
    .split(' ')
    .map((entry) => entry.split(','))
    .filter((parts) => parts.length >= 2 && parts[0] === 'v1')
    .some((parts) => timingSafeEqual(expected, parts.slice(1).join(',')))
}

// Static bearer-token mode - compare the `x-webhook-token` header.
export function verifyWebhookToken(received: string | null | undefined, expected: string): boolean {
  if (!received || !expected) return false
  return timingSafeEqual(received, expected)
}
