// ─── Safe Redirect Target ───────────────────────────────────────────────────
// Relative-path-only enforcement for user-controlled redirect destinations
// (e.g. OAuth `next` param). Absolute URLs are never legitimate here: every
// post-auth destination lives on our own origin.
//
// Defense layers, in order:
// 1. Control chars rejected (header/payload smuggling hygiene).
// 2. Any URI scheme rejected (`javascript:`, `data:`, `https:`, ...).
//    Trimmed first so leading whitespace cannot dodge the scheme test.
// 3. Backslash rejected anywhere (WHATWG normalizes `\` to `/` for http(s)
//    URLs, parser differentials are the documented bypass vector).
// 4. `@` before the first `/` rejected (userinfo/host confusion).
// 5. Leading `//` rejected (protocol-relative escape to foreign host).
// 6. WHATWG parse against a fixed base, origin must match (catches every
//    residual encoding or normalization trick that yields a foreign host).
//
// Pure function, no I/O, unit tested in modules/auth/__tests__/.

export function isSafeNext(next: string | undefined): boolean {
  if (!next) return true
  const trimmed = next.trim()
  if (!trimmed) return false
  if (/[\u0000-\u001f\u007f]/.test(next)) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false
  if (trimmed.includes('\\')) return false
  const slashIdx = trimmed.indexOf('/')
  const atIdx = trimmed.indexOf('@')
  if (atIdx !== -1 && (slashIdx === -1 || atIdx < slashIdx)) return false
  if (trimmed.startsWith('//')) return false
  try {
    const url = new URL(trimmed, 'http://localhost')
    return url.origin === 'http://localhost'
  } catch {
    return false
  }
}
