import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SUMOPOD_MIN_AMOUNT_IDR, isAutoPayAllowed, qrisFee, qrisTotal, isQrisAmountMatch } from '../payments'

describe('isAutoPayAllowed', () => {
  it('floor is Rp10.000', () => {
    assert.equal(SUMOPOD_MIN_AMOUNT_IDR, 10_000)
  })
  it('rejects below floor even when configured', () => {
    assert.equal(isAutoPayAllowed(9_999, true), false)
  })
  it('accepts exactly the floor', () => {
    assert.equal(isAutoPayAllowed(10_000, true), true)
  })
  it('accepts above the floor', () => {
    assert.equal(isAutoPayAllowed(45_000, true), true)
  })
  it('rejects any price when the key is missing', () => {
    assert.equal(isAutoPayAllowed(45_000, false), false)
  })
  it('rejects non-finite prices', () => {
    assert.equal(isAutoPayAllowed(NaN, true), false)
  })
})

describe('qrisFee / qrisTotal', () => {
  it('10k → fee 370 (70+300)', () => {
    assert.equal(qrisFee(10_000), 370)
    assert.equal(qrisTotal(10_000), 10_370)
  })
  it('ceil on fractional pct', () => {
    // 10_001 * 0.007 = 70.007 → ceil 71 + 300 = 371
    assert.equal(qrisFee(10_001), 371)
    assert.equal(qrisTotal(10_001), 10_372)
  })
  it('100k → fee 1000 (700+300)', () => {
    assert.equal(qrisFee(100_000), 1000)
    assert.equal(qrisTotal(100_000), 101_000)
  })
  it('isQrisAmountMatch accepts base or total', () => {
    assert.equal(isQrisAmountMatch(10_000, 10_000), true)
    assert.equal(isQrisAmountMatch(10_000, 10_370), true)
    assert.equal(isQrisAmountMatch(10_000, 10_371), false)
  })
})
