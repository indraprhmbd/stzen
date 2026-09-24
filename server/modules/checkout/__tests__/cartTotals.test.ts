import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SUMOPOD_MIN_AMOUNT_IDR, isAutoPayAllowed, qrisFee, qrisTotal, isQrisAmountMatch } from '../../../shared/lib/payments'

// Cart aggregate money invariants. checkout_cart RPC recomputes these
// server-side; the browser must never supply totals. Per-unit fee sums
// differ from the aggregate fee, so client-computed totals are rejected
// by construction.
describe('cart aggregate totals', () => {
  it('fee matches the RPC formula across subtotals', () => {
    for (const subtotal of [10_000, 10_001, 12_000, 45_000, 100_000, 250_000]) {
      assert.equal(qrisFee(subtotal), Math.ceil(subtotal * 0.007) + 300)
      assert.equal(qrisTotal(subtotal), subtotal + qrisFee(subtotal))
    }
  })

  it('per-unit fee sum differs from the aggregate fee', () => {
    assert.notEqual(qrisFee(6_000) * 2, qrisFee(12_000))
  })

  it('floor applies to the aggregate, not each unit', () => {
    assert.equal(SUMOPOD_MIN_AMOUNT_IDR, 10_000)
    assert.equal(isAutoPayAllowed(6_000, true), false)
    assert.equal(isAutoPayAllowed(12_000, true), true)
  })

  it('webhook matches the aggregate base or aggregate total', () => {
    assert.equal(isQrisAmountMatch(12_000, 12_000), true)
    assert.equal(isQrisAmountMatch(12_000, qrisTotal(12_000)), true)
    assert.equal(isQrisAmountMatch(12_000, 12_001), false)
  })

  it('quantity expansion pins subtotal arithmetic', () => {
    const lines = [
      { price: 15_000, quantity: 2 },
      { price: 25_000, quantity: 3 },
    ]
    const units = lines.reduce((n, line) => n + line.quantity, 0)
    const subtotal = lines.reduce((n, line) => n + line.price * line.quantity, 0)
    assert.equal(units, 5)
    assert.equal(subtotal, 105_000)
    assert.equal(qrisTotal(subtotal), subtotal + qrisFee(subtotal))
  })
})
