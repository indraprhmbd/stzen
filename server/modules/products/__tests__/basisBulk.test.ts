// Basis bulk-import unit tests: parser dialect + row validation.
// Pure functions only (no Supabase): commit path reuses validateBasisRows,
// so preview/commit parity holds by construction.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsvText, bulkChecksum, issuesToCsv } from '../../../shared/lib/csvBulk'
import { validateBasisRows, basisBulkTemplate, BASIS_BULK_COLUMNS } from '../products.service'

const COLS = BASIS_BULK_COLUMNS

describe('parseCsvText', () => {
  it('parses comma csv with quoted commas and doubled quotes', () => {
    const p = parseCsvText('name,category,price\n"Netflix, Premium",Streaming,45000\n"He said ""hi""",Desain,10000', COLS)
    assert.equal(p.delimiter, ',')
    assert.equal(p.rows.length, 2)
    assert.equal(p.rows[0].values.name, 'Netflix, Premium')
    assert.equal(p.rows[1].values.name, 'He said "hi"')
  })

  it('strips BOM and accepts CRLF', () => {
    const p = parseCsvText('﻿name,category\r\nCanva,Desain\r\n', COLS)
    assert.deepEqual(p.headers, ['name', 'category'])
    assert.equal(p.rows[0].values.name, 'Canva')
  })

  it('accepts semicolon dialect and indonesian aliases', () => {
    const p = parseCsvText('nama;kategori;harga\nCanva;Desain;10000', COLS)
    assert.equal(p.delimiter, ';')
    assert.deepEqual(p.headers, ['name', 'category', 'price'])
    assert.equal(p.rows[0].values.price, '10000')
  })

  it('rejects unknown headers fail-closed', () => {
    assert.throws(() => parseCsvText('name,kategori_typo\nCanva,Desain', COLS), /tidak dikenal/)
  })

  it('rejects duplicate headers', () => {
    assert.throws(() => parseCsvText('name,category,name\nA,B,C', COLS), /duplikat/)
  })

  it('rejects missing required column', () => {
    assert.throws(() => parseCsvText('name\nCanva', COLS), /wajib/)
  })

  it('rejects ragged rows with column counts', () => {
    assert.throws(() => parseCsvText('name,category\nCanva', COLS), /kekurangan kolom/)
    assert.throws(() => parseCsvText('name,category\nCanva,Desain,Extra', COLS), /kelebihan kolom/)
  })

  it('rejects unterminated quotes', () => {
    assert.throws(() => parseCsvText('name,category\n"Canva,Desain', COLS), /tidak pernah ditutup/)
  })

  it('skips blank lines and counts them', () => {
    const p = parseCsvText('name,category\n\nCanva,Desain\n   \n', COLS)
    assert.equal(p.rows.length, 1)
    assert.equal(p.skipped, 2)
  })

  it('enforces the row cap', () => {
    const big = 'name,category\n' + Array.from({ length: 501 }, (_, i) => `P${i},C`).join('\n')
    assert.throws(() => parseCsvText(big, COLS), /maksimal 500/)
  })

  it('checksum is stable per bytes', () => {
    assert.equal(bulkChecksum('a,b\n1,2'), bulkChecksum('a,b\n1,2'))
    assert.notEqual(bulkChecksum('a,b\n1,2'), bulkChecksum('a,b\n1,3'))
  })

  it('issuesToCsv quotes messages with commas', () => {
    const csv = issuesToCsv([{ row: 2, column: 'name', code: 'required', message: 'a,b', severity: 'error' }])
    assert.match(csv, /"a,b"/)
  })
})

describe('validateBasisRows', () => {
  function run(csv: string) {
    return validateBasisRows(parseCsvText(csv, COLS))
  }

  it('accepts a clean file with defaults', () => {
    const { valid, issues } = run('name,category\nCanva,Desain')
    assert.equal(valid.length, 1)
    assert.deepEqual(issues, [])
    assert.equal(valid[0].price, 0)
    assert.equal(valid[0].isActive, true)
  })

  it('coerces price and boolean aliases', () => {
    const { valid, issues } = run('name,category,price,is_active\nCanva,Desain,45000,Ya')
    assert.deepEqual(issues, [])
    assert.equal(valid[0].price, 45000)
    assert.equal(valid[0].isActive, true)
  })

  it('flags bad integers, booleans, lengths per row', () => {
    const { valid, issues } = run('name,category,price,is_active,overview\n,Desain,45rb,mungkin,' + 'x'.repeat(201))
    assert.equal(valid.length, 0)
    const codes = issues.map((e) => e.code).sort()
    assert.deepEqual(codes, ['bad_boolean', 'bad_integer', 'required', 'too_long'])
    assert.ok(issues.every((e) => e.row === 2 && e.severity === 'error'))
  })

  it('warns on in-file name+category duplicates without blocking', () => {
    const { valid, issues } = run('name,category\nCanva,Desain\nCANVA,desain')
    assert.equal(valid.length, 2)
    assert.equal(issues.length, 1)
    assert.equal(issues[0].severity, 'warning')
    assert.equal(issues[0].code, 'dup_in_file')
  })

  it('rejects embedded newlines in single-line fields', () => {
    const { valid, issues } = run('name,category,overview\nCanva,Desain,"baris satu\nbaris dua"')
    assert.equal(valid.length, 0)
    assert.equal(issues[0].code, 'multiline_deferred')
  })

  it('template headers match the accepted contract', () => {
    const t = basisBulkTemplate()
    assert.deepEqual(t.headers, ['name', 'category', 'overview', 'tags', 'price', 'is_active'])
    assert.ok(t.samples.length > 0)
  })

  it('accepts the legacy badge header via alias', () => {
    const { valid, issues } = run('name,category,badge\nCanva,Desain,PROMO')
    assert.deepEqual(issues, [])
    assert.equal(valid[0].badge, 'PROMO')
  })
})
