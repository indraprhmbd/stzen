// Stok bulk-import unit tests: row validation, masking, template parity.
// Pure functions only (no Supabase, no crypto): variant resolution lives in
// the service layer (two batched queries); commit re-runs validate+resolve,
// so parity holds by construction. Masking is asserted to leak zero secret
// content.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsvText } from '../../../shared/lib/csvBulk'
import { validateStokRows, maskCredential, stokBulkTemplate, STOK_BULK_COLUMNS } from '../vault.service'

const COLS = STOK_BULK_COLUMNS

describe('validateStokRows', () => {
  function run(csv: string) {
    return validateStokRows(parseCsvText(csv, COLS))
  }

  it('accepts clean rows, colon-less lines pass silently', () => {
    const { valid, issues } = run('variant_ref,credential\nABC,user1:x\nDEF,TOKEN123')
    assert.equal(valid.length, 2)
    assert.equal(issues.length, 0)
  })

  it('flags missing ref and credential per row', () => {
    const { valid, issues } = run('variant_ref,credential\n,a:b\nABC,')
    assert.equal(valid.length, 0)
    assert.deepEqual(issues.map((e) => e.code).sort(), ['required', 'required'])
  })

  it('rejects multiline credentials', () => {
    const { valid, issues } = run('variant_ref,credential\nABC,"line1\nline2"')
    assert.equal(valid.length, 0)
    assert.ok(issues.some((e) => e.code === 'multiline_deferred'))
  })

  it('warns on duplicate ref+credential, keeps rows valid', () => {
    const { valid, issues } = run('variant_ref,credential\nA,u:p\nA,u:p')
    assert.equal(valid.length, 2)
    assert.equal(issues.length, 1)
    assert.equal(issues[0]!.code, 'dup_in_file')
  })
})

describe('maskCredential', () => {
  it('reveals length only, never content', () => {
    const secret = 'super-secret-password-123'
    const masked = maskCredential(secret)
    assert.ok(!masked.includes(secret))
    assert.ok(!masked.includes('super'))
    assert.match(masked, /\(25 karakter\)/)
  })
})

describe('stokBulkTemplate', () => {
  it('headers match the column registry', () => {
    const t = stokBulkTemplate()
    assert.deepEqual(t.headers, COLS.map((c) => c.header))
    assert.equal(t.entity, 'stok')
    assert.ok(t.samples.length > 0)
  })
})
