// Tag token normalization tests: ?tags= values -> trigger-written form.
// Pure function only (no Supabase): the list filter reuses parseTagTokens,
// so route/service parity holds by construction.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseTagTokens } from '../products.service'

describe('parseTagTokens', () => {
  it('uppercases and trims', () => {
    assert.deepEqual(parseTagTokens([' promo ', 'terlaris']), ['PROMO', 'TERLARIS'])
  })

  it('drops empties and dedupes', () => {
    assert.deepEqual(parseTagTokens(['', 'A', 'a', '  ']), ['A'])
  })

  it('strips quotes so tokens never break the overlap literal', () => {
    assert.deepEqual(parseTagTokens(['a"b']), ['AB'])
  })

  it('caps at 10 tokens', () => {
    const many = Array.from({ length: 15 }, (_, i) => `T${i}`)
    assert.equal(parseTagTokens(many).length, 10)
  })

  it('accepts empty input', () => {
    assert.deepEqual(parseTagTokens([]), [])
  })
})
