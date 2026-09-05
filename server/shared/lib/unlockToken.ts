// ─── Vault Unlock Token ─────────────────────────────────────────────────────
// Soft gate for plaintext credential listing. One click mints a 10 minute
// HMAC token (user id + expiry, server secret). Decrypt endpoints require it
// via requireUnlock. Honest scope: the KEK lives in server env, so this
// bounds casual exposure (stale tabs, shoulder surfing), not attackers with
// a valid admin session. Uses Web Crypto only, per repo convention.

import { timingSafeEqual } from './hmac'

const encoder = new TextEncoder()

export const VAULT_UNLOCK_TTL_MS = 10 * 60 * 1000

function unlockSecret(): string {
  const s = process.env.AES_SECRET_KEY
  if (!s) throw new Error('AES_SECRET_KEY not configured')
  return s
}

async function sign(userId: string, expiry: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(unlockSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${userId}.${expiry}`))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function mintUnlockToken(userId: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + VAULT_UNLOCK_TTL_MS
  const sig = await sign(userId, expiresAt)
  return { token: `${expiryToStr(expiresAt)}.${sig}`, expiresAt }
}

function expiryToStr(expiry: number): string {
  return expiry.toString(36)
}

function parseExpiry(raw: string): number | null {
  const n = parseInt(raw, 36)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function verifyUnlockToken(userId: string, token: string): Promise<boolean> {
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const expiry = parseExpiry(token.slice(0, dot))
  if (expiry === null || expiry < Date.now()) return false
  const expected = await sign(userId, expiry)
  return timingSafeEqual(expected, token.slice(dot + 1).toLowerCase())
}
