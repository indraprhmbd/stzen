// bulkApprove unit tests: aggregation over an injected transition runner.
// DB-free: run/audit stubs stand in for transitionStatus + appendAudit.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ordersService, type BulkActor } from '../orders.service'

const actor: BulkActor = { sub: 'admin-1', email: 'admin@stzen.id' }

describe('bulkApprove', () => {
  it('approves every id and audits each success', async () => {
    const ran: string[] = []
    const audited: string[] = []
    const out = await ordersService.bulkApprove(['A', 'B'], actor, {
      run: async (id) => {
        ran.push(id)
        return { publicId: id, productName: 'P' }
      },
      audit: async (order) => {
        audited.push(order.publicId)
      },
    })
    assert.deepEqual(out, { scanned: 2, approved: 2, skipped: [] })
    assert.deepEqual(ran, ['A', 'B'])
    assert.deepEqual(audited, ['A', 'B'])
  })

  it('skips failures with reason and continues the rest', async () => {
    const out = await ordersService.bulkApprove(['A', 'B', 'C'], actor, {
      run: async (id) => {
        if (id === 'B') throw new Error('Cannot approve order in PAID status')
        return { publicId: id }
      },
      audit: async () => {},
    })
    assert.equal(out.scanned, 3)
    assert.equal(out.approved, 2)
    assert.deepEqual(out.skipped, [{ id: 'B', reason: 'Cannot approve order in PAID status' }])
  })

  it('non-Error throws become generic Gagal skips', async () => {
    const out = await ordersService.bulkApprove(['A'], actor, {
      run: async () => {
        throw 'string-boom'
      },
      audit: async () => {},
    })
    assert.deepEqual(out, { scanned: 1, approved: 0, skipped: [{ id: 'A', reason: 'Gagal' }] })
  })

  it('empty ids returns a zero result', async () => {
    const out = await ordersService.bulkApprove([], actor, {
      run: async (id) => ({ publicId: id }),
      audit: async () => {},
    })
    assert.deepEqual(out, { scanned: 0, approved: 0, skipped: [] })
  })
})
