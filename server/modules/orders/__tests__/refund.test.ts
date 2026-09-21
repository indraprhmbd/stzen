// Refund math + warranty preview assembly, DB-free: deps injected, `now`
// passed explicitly. Live smoke covers the real supabaseAdmin defaults.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeRefund, durationToDays, serviceFeeTier } from '../../../shared/lib/refundCalc'
import { warrantyService } from '../warranty.service'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-21T00:00:00Z').getTime()
const paidDaysAgo = (d: number) => new Date(NOW - d * DAY).toISOString()

function deps(over: any = {}) {
  return {
    fetchOrder: async () => ({
      id: 'internal-1',
      amount: 90000,
      status: 'DELIVERED',
      paid_at: paidDaysAgo(10),
      duration_snapshot: 30,
      duration_snapshot_unit: 'day',
    }),
    countClaims: async () => 0,
    listClaims: async () => [],
    insertClaim: async () => {},
    ...over,
  }
}

describe('durationToDays', () => {
  it('maps day/week/month units', () => {
    assert.equal(durationToDays(30, 'day'), 30)
    assert.equal(durationToDays(2, 'week'), 14)
    assert.equal(durationToDays(1, 'month'), 30)
  })

  it('returns null for unknown unit or non-positive value', () => {
    assert.equal(durationToDays(30, 'year'), null)
    assert.equal(durationToDays(0, 'day'), null)
  })
})

describe('serviceFeeTier', () => {
  it('under 1 week ignores claim count', () => {
    assert.deepEqual(serviceFeeTier(3, 5), { tier: 'under_1_week', fee: 0.8 })
  })

  it('exactly 7 days falls to the claim branch', () => {
    assert.deepEqual(serviceFeeTier(7, 0), { tier: 'no_claim', fee: 0.7 })
  })

  it('walks the claim ladder', () => {
    assert.equal(serviceFeeTier(10, 0).fee, 0.7)
    assert.equal(serviceFeeTier(10, 1).fee, 0.6)
    assert.equal(serviceFeeTier(10, 2).fee, 0.6)
    assert.equal(serviceFeeTier(10, 3).fee, 0.5)
    assert.equal(serviceFeeTier(10, 4).fee, 0.4)
  })
})

describe('computeRefund', () => {
  it('prorates remaining duration with fee', () => {
    // 30d total, 10d used → 20/30 × 90000 × 0.7 = 42000
    const p = computeRefund({ amount: 90000, totalValue: 30, totalUnit: 'day', paidAt: paidDaysAgo(10), now: NOW, claimCount: 0 })
    assert.equal(p?.refund, 42000)
    assert.equal(p?.fee, 0.7)
  })

  it('floors fractional rupiah', () => {
    const p = computeRefund({ amount: 100000, totalValue: 30, totalUnit: 'day', paidAt: paidDaysAgo(10), now: NOW, claimCount: 1 })
    // 20/30 × 100000 × 0.6 = 40000.0x → floor
    assert.equal(p?.refund, Math.floor((100000 * 20) / 30 * 0.6))
  })

  it('clamps overused orders to zero, never negative', () => {
    const p = computeRefund({ amount: 90000, totalValue: 30, totalUnit: 'day', paidAt: paidDaysAgo(45), now: NOW, claimCount: 0 })
    assert.equal(p?.refund, 0)
  })

  it('returns null without duration data', () => {
    assert.equal(
      computeRefund({ amount: 90000, totalValue: null, totalUnit: null, paidAt: paidDaysAgo(10), now: NOW, claimCount: 0 }),
      null
    )
  })
})

describe('warrantyService.getRefundPreview', () => {
  it('assembles amount + claims + math', async () => {
    const r = await warrantyService.getRefundPreview('ABC', NOW, deps())
    assert.equal(r.amount, 90000)
    assert.equal(r.claimCount, 0)
    assert.equal(r.preview?.refund, 42000)
  })

  it('claim count moves the tier', async () => {
    const r = await warrantyService.getRefundPreview('ABC', NOW, deps({ countClaims: async () => 2 }))
    assert.equal(r.preview?.fee, 0.6)
  })

  it('throws BadRequest for unpaid orders', async () => {
    const d = deps({ fetchOrder: async () => ({ id: 'x', amount: 1, status: 'PENDING', paid_at: null, duration_snapshot: 30, duration_snapshot_unit: 'day' }) })
    await assert.rejects(() => warrantyService.getRefundPreview('ABC', NOW, d), /belum dibayar/i)
  })

  it('throws NotFound for unknown orders', async () => {
    await assert.rejects(() => warrantyService.getRefundPreview('NOPE', NOW, deps({ fetchOrder: async () => null })), /tidak ditemukan/i)
  })
})

describe('warrantyService.recordClaim', () => {
  it('rejects non-DELIVERED orders', async () => {
    const d = deps({ fetchOrder: async () => ({ id: 'x', status: 'PAID' }) })
    await assert.rejects(() => warrantyService.recordClaim('ABC', null, { sub: 'a' }, d), /DELIVERED/)
  })

  it('returns fresh count after insert', async () => {
    const r = await warrantyService.recordClaim('ABC', 'ganti akun', { sub: 'a' }, deps({ countClaims: async () => 1 }))
    assert.equal(r.claimCount, 1)
  })
})
