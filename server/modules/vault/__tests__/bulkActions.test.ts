// vaultBulk unit tests: aggregation over injected run/audit stubs.
// DB-free: covers both remove (delete untouched) and revokeMany.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { vaultBulkService, type VaultBulkActor } from '../vault.service'

const actor: VaultBulkActor = { sub: 'admin-1', email: 'admin@stzen.id' }

describe('vaultBulkService.remove', () => {
  it('deletes every id and audits each success', async () => {
    const ran: string[] = []
    const audited: string[] = []
    const out = await vaultBulkService.remove(['A', 'B'], actor, {
      run: async (id) => {
        ran.push(id)
        return { id }
      },
      audit: async (row) => {
        audited.push(row.id)
      },
    })
    assert.deepEqual(out, { scanned: 2, processed: 2, skipped: [] })
    assert.deepEqual(ran, ['A', 'B'])
    assert.deepEqual(audited, ['A', 'B'])
  })

  it('skips touched rows with reason and continues the rest', async () => {
    const out = await vaultBulkService.remove(['A', 'B', 'C'], actor, {
      run: async (id) => {
        if (id === 'B') throw new Error('Terikat order')
        return { id }
      },
      audit: async () => {},
    })
    assert.equal(out.scanned, 3)
    assert.equal(out.processed, 2)
    assert.deepEqual(out.skipped, [{ id: 'B', reason: 'Terikat order' }])
  })

  it('non-Error throws become generic Gagal skips', async () => {
    const out = await vaultBulkService.remove(['A'], actor, {
      run: async () => {
        throw 'string-boom'
      },
      audit: async () => {},
    })
    assert.deepEqual(out, { scanned: 1, processed: 0, skipped: [{ id: 'A', reason: 'Gagal' }] })
  })

  it('empty ids returns a zero result', async () => {
    const out = await vaultBulkService.remove([], actor, {
      run: async (id) => ({ id }),
      audit: async () => {},
    })
    assert.deepEqual(out, { scanned: 0, processed: 0, skipped: [] })
  })
})

describe('vaultBulkService.revokeMany', () => {
  it('revokes every id and audits each success', async () => {
    const audited: string[] = []
    const out = await vaultBulkService.revokeMany(['V'], actor, {
      run: async (id) => ({ id }),
      audit: async (row) => {
        audited.push(row.id)
      },
    })
    assert.deepEqual(out, { scanned: 1, processed: 1, skipped: [] })
    assert.deepEqual(audited, ['V'])
  })
})
