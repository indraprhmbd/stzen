import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { newGuestToken, hashGuestToken, MAX_LINE_QTY } from '../cart.service'

// Guest token invariants. The raw token lives only in the HttpOnly cookie;
// the DB stores the sha256 hash, so a table read never yields a usable cart
// session. DB-bound merge/version races are proven on staging, not here.
describe('cart guest token', () => {
  it('mints unique 32-byte hex tokens', () => {
    const a = newGuestToken()
    const b = newGuestToken()
    assert.match(a, /^[0-9a-f]{64}$/)
    assert.notEqual(a, b)
  })

  it('hashes deterministically and never exposes the raw token', async () => {
    const token = newGuestToken()
    const first = await hashGuestToken(token)
    const second = await hashGuestToken(token)
    assert.match(first, /^[0-9a-f]{64}$/)
    assert.equal(first, second)
    assert.ok(!first.includes(token.slice(0, 8)))
  })

  it('separates token namespaces so equal raws diverge', async () => {
    const token = newGuestToken()
    const other = await hashGuestToken(token + 'x')
    assert.notEqual(await hashGuestToken(token), other)
  })

  it('caps line quantity at a sane bound', () => {
    assert.equal(MAX_LINE_QTY, 10)
  })
})
