// bulkStatus unit tests: aggregation over injected run/audit stubs.
// DB-free: covers both product and variant status services (shared loop).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { productStatusService, variantStatusService, type BulkStatusActor } from '../products.service'

const actor: BulkStatusActor = { sub: 'admin-1', email: 'admin@stzen.id' }

describe('productStatusService.setActive', () => {
  it('updates every id and audits each success', async () => {
    const ran: string[] = []
    const audited: string[] = []
    const out = await productStatusService.setActive(['A', 'B'], false, actor, {
      run: async (id) => {
        ran.push(id)
        return { publicId: id, name: 'P' }
      },
      audit: async (row) => {
        audited.push(row.publicId)
      },
    })
    assert.deepEqual(out, { scanned: 2, updated: 2, skipped: [] })
    assert.deepEqual(ran, ['A', 'B'])
    assert.deepEqual(audited, ['A', 'B'])
  })

  it('skips failures with reason and continues the rest', async () => {
    const out = await productStatusService.setActive(['A', 'B', 'C'], false, actor, {
      run: async (id) => {
        if (id === 'B') throw new Error('Sudah nonaktif')
        return { publicId: id, name: 'P' }
      },
      audit: async () => {},
    })
    assert.equal(out.scanned, 3)
    assert.equal(out.updated, 2)
    assert.deepEqual(out.skipped, [{ id: 'B', reason: 'Sudah nonaktif' }])
  })

  it('non-Error throws become generic Gagal skips', async () => {
    const out = await productStatusService.setActive(['A'], true, actor, {
      run: async () => {
        throw 'string-boom'
      },
      audit: async () => {},
    })
    assert.deepEqual(out, { scanned: 1, updated: 0, skipped: [{ id: 'A', reason: 'Gagal' }] })
  })

  it('empty ids returns a zero result', async () => {
    const out = await productStatusService.setActive([], true, actor, {
      run: async (id) => ({ publicId: id, name: 'P' }),
      audit: async () => {},
    })
    assert.deepEqual(out, { scanned: 0, updated: 0, skipped: [] })
  })
})

describe('variantStatusService.setActive', () => {
  it('updates every id and audits each success', async () => {
    const audited: string[] = []
    const out = await variantStatusService.setActive(['V'], true, actor, {
      run: async (id) => ({ publicId: id, name: 'Var' }),
      audit: async (row) => {
        audited.push(row.publicId)
      },
    })
    assert.deepEqual(out, { scanned: 1, updated: 1, skipped: [] })
    assert.deepEqual(audited, ['V'])
  })
})
