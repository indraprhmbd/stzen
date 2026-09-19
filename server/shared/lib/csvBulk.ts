// ─── Shared CSV bulk-import core ─────────────────────────────────────────────
// Canonical parser + header registry + coercion helpers for every bulk tab
// (Basis, Varian, Stok). Preview and commit MUST both funnel through here:
// the client never parses authoritatively, it only ships raw csvText.
// No new dependency: strict RFC-4180-style state machine (quoted commas,
// doubled quotes, quoted newlines), covered by golden fixtures in
// server/modules/products/__tests__/basisBulk.test.ts.

import { BadRequestError } from '../errors/http'

export const BULK_ROW_LIMIT = 500
export const BULK_TEXT_LIMIT = 1_048_576
export const BULK_CELL_LIMIT = 5000
export const BULK_COLUMN_LIMIT = 30
export const BULK_ISSUE_CAP = 200

export type BulkSeverity = 'error' | 'warning'

export interface BulkIssue {
  row: number
  column?: string
  code: string
  message: string
  severity: BulkSeverity
}

export interface BulkColumn {
  header: string
  label: string
  required?: boolean
  aliases?: string[]
}

export interface ParsedRow {
  row: number
  values: Record<string, string>
}

export interface ParsedCsv {
  delimiter: string
  headers: string[]
  rows: ParsedRow[]
  skipped: number
}

function fail(message: string): never {
  throw new BadRequestError(message)
}

// Delimiter detect on the first physical line, quote-aware. Comma wins ties
// (template dialect); semicolon/tab accepted for Indonesian Excel exports.
function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i]!
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') i++
      else inQuotes = !inQuotes
    } else if (!inQuotes && ch in counts) {
      counts[ch] = (counts[ch] ?? 0) + 1
    }
  }
  // Comma wins ties (template dialect); nonzero count required.
  let best: ',' | ';' | '\t' = ','
  let bestCount = 0
  for (const d of [',', ';', '\t'] as const) {
    const n = counts[d] ?? 0
    if (n > bestCount) {
      best = d
      bestCount = n
    }
  }
  return best
}

interface RawRecord {
  fields: string[]
  startLine: number
}

// State machine: one pass, quoted newlines stay inside the field, "" is one
// quote, stray quotes and unterminated fields are hard errors (never silent).
function parseRecords(text: string, delimiter: string): { records: RawRecord[]; blankLines: number } {
  const records: RawRecord[] = []
  let blankLines = 0
  let field = ''
  let fields: string[] = []
  let inQuotes = false
  let line = 1
  let startLine = 1
  let fieldStartLine = 1

  const endField = () => {
    fields.push(field)
    field = ''
  }
  const endRecord = () => {
    endField()
    // Blank physical line: zero content, not a data row.
    if (fields.length === 1 && fields[0] === '') {
      blankLines++
    } else {
      records.push({ fields, startLine })
    }
    fields = []
    startLine = line
    fieldStartLine = line
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\n') {
      if (inQuotes) {
        field += '\n'
        line++
      } else {
        endRecord()
        line++
        startLine = line
        fieldStartLine = line
      }
    } else if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (inQuotes) {
        inQuotes = false
      } else if (field === '') {
        inQuotes = true
        fieldStartLine = line
      } else {
        fail(`Baris ${line}: tanda kutip tak terduga di tengah kolom, kutip seluruh isi kolom`)
      }
    } else if (ch === delimiter && !inQuotes) {
      endField()
    } else {
      if (!inQuotes && field === '' && (ch === ' ' || ch === '\t')) {
        // Leading padding before a quoted field is tolerated, not kept.
        let j = i
        while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++
        if (text[j] === '"') {
          i = j - 1
          continue
        }
      }
      field += ch
    }
  }
  if (inQuotes) fail(`Baris ${fieldStartLine}: kolom dikutip tidak pernah ditutup`)
  if (field !== '' || fields.length > 0) endRecord()
  return { records, blankLines }
}

function normalizeHeader(raw: string): string {
  return raw.replace(/^\uFEFF/, '').trim().toLowerCase()
}

export function parseCsvText(text: string, columns: BulkColumn[]): ParsedCsv {
  if (typeof text !== 'string' || text.trim() === '') {
    fail('CSV kosong: tempel isi atau pilih file dulu')
  }
  if (text.length > BULK_TEXT_LIMIT) {
    fail(`CSV melebihi 1MB (${text.length} karakter), pecah jadi beberapa file`)
  }

  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const firstLine = clean.split('\n', 1)[0] ?? ''
  const delimiter = detectDelimiter(firstLine)
  const { records, blankLines } = parseRecords(clean, delimiter)
  if (records.length === 0) fail('CSV kosong: tidak ada baris terbaca')

  const rawHeaders = records[0]!.fields
  if (rawHeaders.length > BULK_COLUMN_LIMIT) {
    fail(`Terlalu banyak kolom (${rawHeaders.length}), maksimal ${BULK_COLUMN_LIMIT}`)
  }

  const byName = new Map<string, BulkColumn>()
  for (const c of columns) {
    byName.set(c.header, c)
    for (const a of c.aliases ?? []) byName.set(a.toLowerCase(), c)
  }

  const headers: string[] = []
  const seen = new Set<string>()
  rawHeaders.forEach((raw, i) => {
    const norm = normalizeHeader(raw)
    if (!norm) fail(`Header kolom ke-${i + 1} kosong`)
    const col = byName.get(norm)
    if (!col) fail(`Header "${raw.trim()}" tidak dikenal, pakai template resmi`)
    if (seen.has(col.header)) fail(`Header "${col.header}" duplikat`)
    seen.add(col.header)
    headers.push(col.header)
  })
  for (const c of columns) {
    if (c.required && !seen.has(c.header)) {
      fail(`Kolom wajib "${c.header}" hilang dari header`)
    }
  }

  const rows: ParsedRow[] = []
  let skipped = blankLines
  for (let i = 1; i < records.length; i++) {
    const rec = records[i]!
    // Whitespace-only line (spaces/tabs left by editors): blank, not data.
    if (rec.fields.length === 1 && rec.fields[0]!.trim() === '') {
      skipped++
      continue
    }
    if (rec.fields.length !== headers.length) {
      const want = headers.length
      const got = rec.fields.length
      fail(
        got > want
          ? `Baris ${rec.startLine}: kelebihan kolom (${got} vs ${want}), kutip kolom berisi koma`
          : `Baris ${rec.startLine}: kekurangan kolom (${got} vs ${want}), cek delimiter/pemisah`
      )
    }
    const values: Record<string, string> = {}
    let allEmpty = true
    rec.fields.forEach((cell, j) => {
      if (cell.length > BULK_CELL_LIMIT) {
        fail(`Baris ${rec.startLine} kolom "${headers[j]!}": sel sepanjang ${cell.length} karakter, maksimal ${BULK_CELL_LIMIT}`)
      }
      const v = cell.trim()
      if (v !== '') allEmpty = false
      values[headers[j]!] = v
    })
    if (allEmpty) {
      skipped++
      continue
    }
    rows.push({ row: i + 1, values })
  }

  if (rows.length === 0) fail('Tidak ada baris data: hanya header atau baris kosong')
  if (rows.length > BULK_ROW_LIMIT) {
    fail(`Terlalu banyak baris (${rows.length}), maksimal ${BULK_ROW_LIMIT} per impor`)
  }

  return { delimiter, headers, rows, skipped }
}

// ─── Coercion helpers (shared error wording id) ─────────────────────────────

export function coerceInteger(
  raw: string,
  row: number,
  column: string,
  label: string
): { value: number | null; issue: BulkIssue | null } {
  if (raw === '') return { value: null, issue: null }
  if (!/^\d+$/.test(raw)) {
    return {
      value: null,
      issue: { row, column, code: 'bad_integer', message: `${label} harus angka bulat rupiah, contoh 45000`, severity: 'error' },
    }
  }
  return { value: parseInt(raw, 10), issue: null }
}

const TRUE_SET = new Set(['true', '1', 'ya', 'y'])
const FALSE_SET = new Set(['false', '0', 'tidak', 't'])

export function coerceBoolean(
  raw: string,
  row: number,
  column: string,
  label: string
): { value: boolean | null; issue: BulkIssue | null } {
  if (raw === '') return { value: null, issue: null }
  const norm = raw.trim().toLowerCase()
  if (TRUE_SET.has(norm)) return { value: true, issue: null }
  if (FALSE_SET.has(norm)) return { value: false, issue: null }
  return {
    value: null,
    issue: { row, column, code: 'bad_boolean', message: `${label} isi true/false, 1/0, atau ya/tidak`, severity: 'error' },
  }
}

export function checkSingleLine(
  raw: string,
  row: number,
  column: string,
  label: string
): BulkIssue | null {
  if (raw.includes('\n')) {
    return { row, column, code: 'multiline_deferred', message: `${label} belum dukung multiline di impor CSV, isi lewat dialog setelah impor`, severity: 'error' }
  }
  return null
}

export function checkMaxLength(
  raw: string,
  row: number,
  column: string,
  label: string,
  max: number
): BulkIssue | null {
  if (raw.length > max) {
    return { row, column, code: 'too_long', message: `${label} ${raw.length} karakter, maksimal ${max}`, severity: 'error' }
  }
  return null
}

// Display-only fingerprint proving preview and commit saw the same bytes.
// Never a trust mechanism: commit always re-parses and revalidates.
export function bulkChecksum(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

export function quoteCsvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function issuesToCsv(issues: BulkIssue[]): string {
  const head = 'baris,kolom,kode,tingkat,pesan'
  const lines = issues.map((e) =>
    [e.row, e.column ?? '', e.code, e.severity === 'error' ? 'error' : 'peringatan', e.message].map(quoteCsvCell).join(',')
  )
  return ['\uFEFF' + head, ...lines].join('\r\n')
}
