// Profit snapshot math, DB-free: create freezes cost+profit, approve-manual
// recomputes profit against the frozen cost while PENDING. Full flows hit
// supabaseAdmin directly — covered by live smoke.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeProfitAtPurchase } from '../orders.service'

describe('computeProfitAtPurchase', () => {
  it('returns amount minus cost', () => {
    assert.equal(computeProfitAtPurchase(45000, 30000), 15000)
  })

  it('returns null when cost unknown (excluded, never 100% margin)', () => {
    assert.equal(computeProfitAtPurchase(45000, null), null)
  })

  it('keeps real losses negative, never clamps', () => {
    assert.equal(computeProfitAtPurchase(20000, 30000), -10000)
  })

  it('handles zero price and zero cost', () => {
    assert.equal(computeProfitAtPurchase(0, 0), 0)
    assert.equal(computeProfitAtPurchase(0, null), null)
  })
})
