// Varian bulk-import unit tests: row validation + template parity.
// Pure functions only (no Supabase): parent resolution lives in the service
// layer (one batched query); commit re-runs validate+resolve, so parity
// holds by construction.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsvText } from '../../../shared/lib/csvBulk'
import { validateVarianRows, varianBulkTemplate, VARIAN_BULK_COLUMNS } from '../products.service'

const COLS = VARIAN_BULK_COLUMNS

describe('validateVarianRows', () => {
  function run(csv: string) {
    return validateVarianRows(parseCsvText(csv, COLS))
  }

  it('accepts a clean file with defaults', () => {
    const { valid, issues } = run('basis,duration,unit,price\nABC123,1,bulan,45000')
    assert.equal(valid.length, 1)
    assert.deepEqual(issues, [])
    assert.equal(valid[0]!.unit, 'month')
    assert.equal(valid[0]!.accountType, null)
    assert.equal(valid[0]!.isActive, true)
    assert.equal(valid[0]!.deliveryInfo, false)
  })

  it('accepts indonesian and english unit aliases', () => {
    const { valid, issues } = run('basis,duration,unit,price\nA,7,Hari,15000\nB,2,minggu,20000\nC,1,month,30000\nD,3,MGG,40000')
    assert.deepEqual(issues, [])
    assert.deepEqual(valid.map((v) => v.unit), ['day', 'week', 'month', 'week'])
  })

  it('accepts boolean aliases and zero price', () => {
    const { valid, issues } = run('basis,duration,unit,price,is_active,requires_delivery_info\nA,1,bulan,0,Ya,1')
    assert.deepEqual(issues, [])
    assert.equal(valid[0]!.price, 0)
    assert.equal(valid[0]!.isActive, true)
    assert.equal(valid[0]!.deliveryInfo, true)
  })

  it('flags missing required, bad integers, unknown unit per row', () => {
    const { valid, issues } = run('basis,duration,unit,price\n,1,bulan,45rb\nA,,tahun,10000')
    assert.equal(valid.length, 0)
    const codes = issues.map((e) => e.code).sort()
    assert.deepEqual(codes, ['bad_integer', 'bad_unit', 'required', 'required'])
  })

  it('flags empty price and long account type', () => {
    const { valid, issues } = run('basis,duration,unit,price,account_type\nA,1,bulan,,' + 'x'.repeat(101))
    assert.equal(valid.length, 0)
    const codes = issues.map((e) => e.code).sort()
    assert.deepEqual(codes, ['required', 'too_long'])
  })

  it('warns on duplicate parent+duration+type combo, keeps rows valid', () => {
    const { valid, issues } = run('basis,duration,unit,account_type,price\nA,1,bulan,Private,45000\nA,1,Bulan,private,45000')
    assert.equal(valid.length, 2)
    assert.equal(issues.length, 1)
    assert.equal(issues[0]!.code, 'dup_in_file')
    assert.equal(issues[0]!.severity, 'warning')
  })

  it('maps empty tags to null (ikut induk) and flags long tags', () => {
    const { valid, issues } = run('basis,duration,unit,price,tags\nA,1,bulan,45000,PROMO\nB,1,bulan,45000,\nC,1,bulan,45000,' + 'x'.repeat(51))
    assert.equal(valid.length, 2)
    assert.equal(valid[0]!.tags, 'PROMO')
    assert.equal(valid[1]!.tags, null)
    assert.deepEqual(issues.map((e) => e.code), ['too_long'])
  })

  it('parses optional cost, empty maps to null', () => {
    const { valid, issues } = run('basis,duration,unit,price,cost\nA,1,bulan,45000,30000\nB,1,bulan,45000,')
    assert.deepEqual(issues, [])
    assert.equal(valid[0]!.cost, 30000)
    assert.equal(valid[1]!.cost, null)
  })

  it('flags bad cost integer per row', () => {
    const { valid, issues } = run('basis,duration,unit,price,cost\nA,1,bulan,45000,30rb')
    assert.equal(valid.length, 0)
    assert.deepEqual(issues.map((e) => e.code), ['bad_integer'])
  })
})

describe('varianBulkTemplate', () => {
  it('headers match the column registry', () => {
    const t = varianBulkTemplate()
    assert.deepEqual(t.headers, COLS.map((c) => c.header))
    assert.equal(t.entity, 'varian')
    assert.ok(t.samples.length > 0)
  })
})
