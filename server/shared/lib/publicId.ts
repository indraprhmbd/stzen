// Lightweight public_id generator — 12 chars base64url from 9 random bytes (72 bits)
// No extra dep, Web Crypto only (globalThis.crypto exists in Node 19+ and
// Workers). No node:crypto / Buffer fallback: keeps the Worker bundle edge-safe.
export function generatePublicId(): string {
  const bytes = new Uint8Array(9)
  globalThis.crypto.getRandomValues(bytes)
  // base64url without padding, 12 chars
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 12)
}
