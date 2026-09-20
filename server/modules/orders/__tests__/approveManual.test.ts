// Manual-flow unit tests, DB-free: bulk inspect-skip + zod schemas.
// approveManual itself hits supabaseAdmin directly — covered by live smoke.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ordersService, type BulkActor } from '../orders.service'
import { z } from 'zod'

const actor: BulkActor = { sub: 'admin-1', email: 'admin@stzen.id' }

describe('bulkApprove manual skip', () => {
  it('skips manual-provider rows with reason, approves the rest', async () => {
    const ran: string[] = []
    const out = await ordersService.bulkApprove(['M', 'S', 'L'], actor, {
      inspect: async (id) => {
        if (id === 'M') return { paymentProvider: 'manual' }
        if (id === 'S') return { paymentProvider: 'sumopod' }
        return null
      },
      run: async (id) => {
        ran.push(id)
        return { publicId: id }
      },
      audit: async () => {},
    })
    assert.deepEqual(out, {
      scanned: 3,
      approved: 2,
      skipped: [{ id: 'M', reason: 'Manual: setujui via form review' }],
    })
    assert.deepEqual(ran, ['S', 'L'])
  })

  it('inspect failure falls through to run (fail-open to legacy behavior)', async () => {
    const out = await ordersService.bulkApprove(['X'], actor, {
      inspect: async () => {
        throw new Error('db down')
      },
      run: async (id) => ({ publicId: id }),
      audit: async () => {},
    })
    assert.deepEqual(out, { scanned: 1, approved: 1, skipped: [] })
  })
})

describe('approve-manual schemas', () => {
  const ApproveManualSchema = z.object({
    amount: z.string().regex(/^\d+$/, 'Harga integer').optional(),
    customerAccount: z.string().max(120).optional(),
    waNumber: z.string().max(32).optional(),
  })

  it('accepts empty body (pure approve, no edits)', () => {
    assert.deepEqual(ApproveManualSchema.parse({}), {})
  })

  it('accepts amount + contact together', () => {
    const out = ApproveManualSchema.parse({ amount: '45000', customerAccount: 'user@mail.com', waNumber: '081234' })
    assert.equal(out.amount, '45000')
  })

  it('rejects non-digit amount', () => {
    assert.throws(() => ApproveManualSchema.parse({ amount: '45k' }), /Harga integer/)
  })

  it('rejects overlong contact fields', () => {
    assert.throws(() => ApproveManualSchema.parse({ customerAccount: 'a'.repeat(121) }))
    assert.throws(() => ApproveManualSchema.parse({ waNumber: '1'.repeat(33) }))
  })
})
