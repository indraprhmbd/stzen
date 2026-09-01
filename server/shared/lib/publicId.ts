// Lightweight public_id generator — 12 chars base64url from 9 random bytes (72 bits)
// No extra dep, uses Web Crypto (global crypto.getRandomValues). Keeps URLs short and opaque.
export function generatePublicId(): string {
  const bytes = new Uint8Array(9)
  // global crypto is available in Node 19+ and Edge
  const g: any = globalThis as any
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes)
  } else {
    // fallback for older Node — use node:crypto
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require('node:crypto')
    const rb: Buffer = randomBytes(9)
    bytes.set(rb)
  }
  // base64url without padding, 12 chars
  let b64: string
  // @ts-ignore Buffer available in Node
  if (typeof Buffer !== 'undefined') {
    // @ts-ignore
    b64 = Buffer.from(bytes).toString('base64url')
  } else {
    let bin = ''
    bytes.forEach((b) => (bin += String.fromCharCode(b)))
    b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
  return b64.slice(0, 12)
}
