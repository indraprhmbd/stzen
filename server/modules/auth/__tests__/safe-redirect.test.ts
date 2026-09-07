import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isSafeNext } from '../../../shared/lib/safe-redirect'

// Allow/deny matrix for the OAuth `next` redirect target.
// Every deny case is a documented open-redirect (CWE-601) bypass payload.

describe('isSafeNext', () => {
  const allowed: [string, string][] = [
    ['empty falls back', ''],
    ['plain relative', '/dashboard'],
    ['nested relative', '/admin/orders?status=PAID'],
    ['no leading slash', 'dashboard'],
    ['encoded slashes stay local', '%2F%2Fevil.com'],
  ]
  for (const [name, input] of allowed) {
    it(`allows: ${name}`, () => {
      assert.equal(isSafeNext(input || undefined), true)
    })
  }

  const denied: [string, string][] = [
    ['protocol-relative', '//evil.com'],
    ['protocol-relative with path', '//evil.com/dashboard'],
    ['backslash host', '\\evil.com'],
    ['backslash after slash', '/\\evil.com'],
    ['absolute https', 'https://evil.com'],
    ['absolute http', 'http://evil.com'],
    ['scheme without slashes', 'https:evil.com'],
    ['userinfo confusion', 'https://stzen.web.id@evil.com'],
    ['protocol-relative userinfo', '//user@evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['javascript mixed case', 'JaVaScRiPt:alert(1)'],
    ['javascript padded', '  javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['control chars', '/dash\x00board'],
    ['newline smuggle', '/dashboard\nSet-Cookie: x'],
  ]
  for (const [name, input] of denied) {
    it(`denies: ${name}`, () => {
      assert.equal(isSafeNext(input), false)
    })
  }

  it('denies undefined only by fallback (treated safe, caller defaults)', () => {
    assert.equal(isSafeNext(undefined), true)
  })
})
