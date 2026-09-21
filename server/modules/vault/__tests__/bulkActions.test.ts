// vaultBulk unit tests: set-based batching over injected batched stubs.
// DB-free: covers both remove (delete untouched) and revokeMany.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { vaultBulkService, type VaultBulkActor } from '../vault.service'

const actor: VaultBulkActor = { sub: 'admin-1', email: 'admin@stzen.id' }

type Row = { id: string; status: string; allocated_at: string | null }

function stubDeps(rows: Row[], refs: string[] = [], action: 'vault:delete' | 'vault:revoke' = 'vault:delete') {
  const written: string[][] = []
  const audited: { action: string; ids: string[] }[] = []
  return {
    written,
    audited,
    deps: {
      fetchRows: async (ids: string[]) =>
        new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, r])),
      findRefs: async () => new Set(refs),
      writeDelete: async (ids: string[]) => {
        written.push(ids)
      },
      writeRevoke: async (ids: string[]) => {
        written.push(ids)
      },
      auditMany: async (ids: string[]) => {
        audited.push({ action, ids })
      },
    },
  }
}

describe('vaultBulkService.remove', () => {
  it('deletes every eligible id in one write + one audit batch', async () => {
    const s = stubDeps([
      { id: 'A', status: 'AVAILABLE', allocated_at: null },
      { id: 'B', status: 'AVAILABLE', allocated_at: null },
    ])
    const out = await vaultBulkService.remove(['A', 'B'], actor, s.deps)
    assert.deepEqual(out, { scanned: 2, processed: 2, skipped: [] })
    assert.deepEqual(s.written, [['A', 'B']])
    assert.deepEqual(s.audited, [{ action: 'vault:delete', ids: ['A', 'B'] }])
  })

  it('skips missing/touched/bound rows with reasons in input order', async () => {
    const s = stubDeps(
      [
        { id: 'A', status: 'AVAILABLE', allocated_at: null },
        { id: 'B', status: 'SOLD', allocated_at: '2026-01-01' },
        { id: 'C', status: 'AVAILABLE', allocated_at: '2026-01-01' },
        { id: 'D', status: 'AVAILABLE', allocated_at: null },
      ],
      ['D']
    )
    const out = await vaultBulkService.remove(['A', 'B', 'C', 'D', 'ZZZ'], actor, s.deps)
    assert.equal(out.scanned, 5)
    assert.equal(out.processed, 1)
    assert.deepEqual(out.skipped, [
      { id: 'B', reason: 'Hanya AVAILABLE yang bisa dihapus' },
      { id: 'C', reason: 'Sudah pernah dialokasikan' },
      { id: 'D', reason: 'Terikat order' },
      { id: 'ZZZ', reason: 'Kredensial tidak ditemukan' },
    ])
    assert.deepEqual(s.written, [['A']])
  })

  it('dedupes repeated ids', async () => {
    const s = stubDeps([{ id: 'A', status: 'AVAILABLE', allocated_at: null }])
    const out = await vaultBulkService.remove(['A', 'A'], actor, s.deps)
    assert.deepEqual(out, { scanned: 1, processed: 1, skipped: [] })
  })

  it('empty ids returns a zero result without touching stubs', async () => {
    let called = false
    const out = await vaultBulkService.remove([], actor, {
      fetchRows: async () => {
        called = true
        return new Map()
      },
    })
    assert.deepEqual(out, { scanned: 0, processed: 0, skipped: [] })
    assert.equal(called, false)
  })

  it('write failure throws instead of silently half-applying', async () => {
    const s = stubDeps([{ id: 'A', status: 'AVAILABLE', allocated_at: null }])
    await assert.rejects(
      vaultBulkService.remove(['A'], actor, {
        ...s.deps,
        writeDelete: async () => {
          throw new Error('boom')
        },
      }),
      /boom/
    )
  })
})

describe('vaultBulkService.revokeMany', () => {
  it('revokes SOLD + AVAILABLE in one write, skips the rest', async () => {
    const s = stubDeps(
      [
        { id: 'A', status: 'SOLD', allocated_at: '2026-01-01' },
        { id: 'B', status: 'AVAILABLE', allocated_at: null },
        { id: 'C', status: 'REVOKED', allocated_at: null },
      ],
      [],
      'vault:revoke'
    )
    const out = await vaultBulkService.revokeMany(['A', 'B', 'C'], actor, s.deps)
    assert.deepEqual(out, { scanned: 3, processed: 2, skipped: [{ id: 'C', reason: 'Hanya SOLD atau AVAILABLE yang bisa dicabut' }] })
    assert.deepEqual(s.written, [['A', 'B']])
    assert.deepEqual(s.audited, [{ action: 'vault:revoke', ids: ['A', 'B'] }])
  })

  it('skips SOLD rows bound to an order — Ganti path only', async () => {
    const s = stubDeps(
      [
        { id: 'A', status: 'SOLD', allocated_at: '2026-01-01' },
        { id: 'B', status: 'AVAILABLE', allocated_at: null },
      ],
      ['A'],
      'vault:revoke'
    )
    const out = await vaultBulkService.revokeMany(['A', 'B'], actor, s.deps)
    assert.deepEqual(out, { scanned: 2, processed: 1, skipped: [{ id: 'A', reason: 'Terikat order — gunakan Ganti akses' }] })
    assert.deepEqual(s.written, [['B']])
  })
})
