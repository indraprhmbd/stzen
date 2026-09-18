import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeWaNumber } from '../wa'

describe('normalizeWaNumber', () => {
  it('accepts 08.. and converts to 62..', () => {
    assert.equal(normalizeWaNumber('0882003457148'), '62882003457148')
  })
  it('accepts +62 with separators', () => {
    assert.equal(normalizeWaNumber('+62 882-0034-57148'), '62882003457148')
  })
  it('accepts bare 62..', () => {
    assert.equal(normalizeWaNumber('62882003457148'), '62882003457148')
  })
  it('rejects non-mobile and short input', () => {
    assert.equal(normalizeWaNumber('021123456'), null)
    assert.equal(normalizeWaNumber('0882'), null)
    assert.equal(normalizeWaNumber(''), null)
    assert.equal(normalizeWaNumber('not a number'), null)
  })
  it('rejects non-strings', () => {
    assert.equal(normalizeWaNumber(null), null)
    assert.equal(normalizeWaNumber(62882003457148), null)
  })
})
