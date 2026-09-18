import { useEffect, useState, type ReactNode } from 'react'
import { authedApiRequest } from '../../../lib/api'
import DataTable from '../../../components/admin/DataTable'
import StatusChip from '../../../components/admin/StatusChip'
import { Copy, Download, Upload, Xmark } from 'iconoir-react'

// ─── Reusable bulk-import dialog shell ──────────────────────────────────────
// Generic flow (input -> template -> preview -> commit), schema-specific
// brains live in the per-tab config below. Server parses authoritatively on
// preview AND commit; the client only ships raw csvText, never row objects.

export interface BulkIssue {
  row: number
  column?: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

export interface BulkPreview {
  entity: string
  checksum: string
  delimiter?: string
  total: number
  skipped: number
  valid: number
  invalid: number
  warnings: number
  decisions: Array<Record<string, unknown>>
  issues: BulkIssue[]
  issueTotal: number
  errorCsv: string
}

export interface BulkTemplate {
  entity: string
  headers: string[]
  headerLine: string
  samples: Array<Record<string, string>>
  notes: string[]
  limits: { rows: number; bytes: number }
}

export interface BulkCommitResult {
  entity: string
  batchId: string
  checksum: string
  total: number
  committed: number
  replay?: boolean
}

export interface BulkDecisionColumn {
  label: string
  className?: string
  render: (d: Record<string, unknown>) => ReactNode
}

export interface BulkImportConfig {
  entity: 'basis' | 'varian' | 'stok'
  title: string
  subtitle: string
  sampleFilename: string
  template: () => Promise<BulkTemplate>
  preview: (csvText: string) => Promise<BulkPreview>
  commit: (csvText: string, batchKey: string) => Promise<BulkCommitResult>
  decisionColumns: BulkDecisionColumn[]
}

interface Props {
  config: BulkImportConfig
  open: boolean
  onClose: () => void
  onDone: () => void
  notify: (msg: string, type: 'success' | 'error') => void
}

function quoteCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const varianBulkConfig: BulkImportConfig = {
  entity: 'varian',
  title: 'Impor Varian',
  subtitle: 'Satu baris CSV = satu varian baru di bawah induk',
  sampleFilename: 'template-varian.csv',
  template: async () => {
    const res = await authedApiRequest((c) => c.api.v1.admin.variants.bulk.template.$get())
    if (!res.ok) throw new Error('Gagal memuat template')
    return (await res.json()) as BulkTemplate
  },
  preview: async (csvText: string) => {
    const res = await authedApiRequest((c) => c.api.v1.admin.variants.bulk.preview.$post({ json: { csvText } }))
    const data = (await res.json()) as BulkPreview & { error?: string }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Pratinjau gagal'), { issues: data.issues ?? [] })
    return data
  },
  commit: async (csvText: string, batchKey: string) => {
    const res = await authedApiRequest((c) =>
      c.api.v1.admin.variants.bulk.commit.$post({ json: { csvText, batchKey } })
    )
    const data = (await res.json()) as BulkCommitResult & { error?: string }
    if (!res.ok) throw new Error(data.error || 'Impor gagal')
    return data
  },
  decisionColumns: [
    { label: 'BARIS', render: (d) => <span className="ad-num">{String(d.row)}</span> },
    {
      label: 'NAMA',
      render: (d) => (
        <span>
          <span className="text-[13px] font-medium">{String(d.name)}</span>
          <br />
          <span className="text-[11px] ad-num text-[#6e6e73]">SKU {String(d.skuSample)} (contoh)</span>
        </span>
      ),
    },
    { label: 'INDUK', render: (d) => <span className="text-xs text-[#6e6e73]">{String(d.basisName)}</span> },
    { label: 'DURASI', render: (d) => <span className="text-[13px]">{String(d.durationLabel)}</span> },
    {
      label: 'HARGA',
      render: (d) => <span className="text-[13px] ad-num font-semibold">Rp {Number(d.price).toLocaleString('id-ID')}</span>,
    },
    {
      label: 'AKTIF',
      render: (d) => <StatusChip tone={d.isActive ? 'green' : 'zinc'}>{d.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip>,
    },
  ],
}
export const basisBulkConfig: BulkImportConfig = {
  entity: 'basis',
  title: 'Impor Basis',
  subtitle: 'Satu baris CSV = satu induk baru',
  sampleFilename: 'template-basis.csv',
  template: async () => {
    const res = await authedApiRequest((c) => c.api.v1.admin.products.bulk.template.$get())
    if (!res.ok) throw new Error('Gagal memuat template')
    return (await res.json()) as BulkTemplate
  },
  preview: async (csvText: string) => {
    const res = await authedApiRequest((c) => c.api.v1.admin.products.bulk.preview.$post({ json: { csvText } }))
    const data = (await res.json()) as BulkPreview & { error?: string }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Pratinjau gagal'), { issues: data.issues ?? [] })
    return data
  },
  commit: async (csvText: string, batchKey: string) => {
    const res = await authedApiRequest((c) =>
      c.api.v1.admin.products.bulk.commit.$post({ json: { csvText, batchKey } })
    )
    const data = (await res.json()) as BulkCommitResult & { error?: string }
    if (!res.ok) throw new Error(data.error || 'Impor gagal')
    return data
  },
  decisionColumns: [
    { label: 'BARIS', render: (d) => <span className="ad-num">{String(d.row)}</span> },
    { label: 'NAMA', render: (d) => <span className="text-[13px] font-medium">{String(d.name)}</span> },
    { label: 'KATEGORI', render: (d) => <span className="text-xs text-[#6e6e73]">{String(d.category)}</span> },
    {
      label: 'HARGA',
      render: (d) => <span className="text-[13px] ad-num font-semibold">Rp {Number(d.price).toLocaleString('id-ID')}</span>,
    },
    {
      label: 'AKTIF',
      render: (d) => <StatusChip tone={d.isActive ? 'green' : 'zinc'}>{d.isActive ? 'AKTIF' : 'NONAKTIF'}</StatusChip>,
    },
  ],
}

export default function BulkImportDialog({ config, open, onClose, onDone, notify }: Props) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [template, setTemplate] = useState<BulkTemplate | null>(null)
  const [preview, setPreview] = useState<BulkPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<BulkCommitResult | null>(null)
  const [errorsOnly, setErrorsOnly] = useState(false)

  // Fresh state per open; template loads once from the server registry so
  // copy/download can never drift from accepted columns.
  useEffect(() => {
    if (!open) return
    setCsvText('')
    setFileName('')
    setPreview(null)
    setResult(null)
    setErrorsOnly(false)
    setTemplate(null)
    config
      .template()
      .then(setTemplate)
      .catch(() => notify('Gagal memuat template', 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 1_048_576) {
      notify('File melebihi 1MB, pecah jadi beberapa file', 'error')
      return
    }
    f.text()
      .then((text) => {
        setCsvText(text)
        setFileName(f.name)
        setPreview(null)
        setResult(null)
      })
      .catch(() => notify('Gagal membaca file', 'error'))
  }

  function copyHeader() {
    if (!template) return
    navigator.clipboard.writeText(template.headerLine).then(
      () => notify('Header template disalin', 'success'),
      () => notify('Gagal menyalin', 'error')
    )
  }

  function downloadSample() {
    if (!template) return
    const lines = [
      template.headerLine,
      ...template.samples.map((s) => template.headers.map((h) => quoteCell(s[h] ?? '')).join(',')),
    ]
    download(config.sampleFilename, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8')
  }

  async function runPreview() {
    if (csvText.trim() === '') {
      notify('Tempel CSV atau pilih file dulu', 'error')
      return
    }
    setPreviewLoading(true)
    try {
      const p = await config.preview(csvText)
      setPreview(p)
      setResult(null)
    } catch (e: unknown) {
      const issues = (e as { issues?: BulkIssue[] }).issues
      if (issues && issues.length > 0) {
        // Structural failure still yields row detail: show it as preview.
        setPreview({
          entity: config.entity,
          checksum: '',
          total: 0,
          skipped: 0,
          valid: 0,
          invalid: 0,
          warnings: 0,
          decisions: [],
          issues,
          issueTotal: issues.length,
          errorCsv: '',
        })
      } else {
        notify(e instanceof Error ? e.message : 'Pratinjau gagal', 'error')
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  async function runCommit() {
    if (!preview || preview.invalid > 0 || preview.valid === 0) return
    setCommitting(true)
    try {
      const r = await config.commit(csvText, crypto.randomUUID())
      setResult(r)
      notify(r.replay ? 'Impor sudah pernah diproses, tidak diduplikasi' : `${r.committed} baris diimpor`, 'success')
      onDone()
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Impor gagal', 'error')
    } finally {
      setCommitting(false)
    }
  }

  const blockingErrors = preview?.issues.filter((e) => e.severity === 'error') ?? []
  const shownIssues = (errorsOnly ? blockingErrors : (preview?.issues ?? [])).slice(0, 30)
  const canCommit = !!preview && preview.invalid === 0 && preview.valid > 0 && !committing && !result

  return (
    <dialog open className="modal" style={{ zIndex: 60 }}>
      <div className="modal-box ad-dialog max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[17px] tracking-tight">{config.title}</h3>
            <p className="text-xs text-[#6e6e73] mt-1">{config.subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="ad-btn !px-2.5">
            <Xmark width={15} height={15} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── 1. Template ─────────────────────────────────────────── */}
        <div className="mt-4">
          <div className="ad-label mb-1.5">1 · Salin template</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={copyHeader} disabled={!template} className="ad-btn">
              <Copy width={14} height={14} strokeWidth={1.5} /> Salin header
            </button>
            <button onClick={downloadSample} disabled={!template} className="ad-btn">
              <Download width={14} height={14} strokeWidth={1.5} /> Unduh contoh
            </button>
            {fileName && <span className="text-[11px] ad-num text-[#6e6e73] self-center ml-1">{fileName}</span>}
          </div>
          {template && (
            <div className="mt-2 bg-[#f5f5f7] rounded-[10px] px-3 py-2 font-mono text-[11px] text-[#1d1d1f] overflow-x-auto whitespace-nowrap">
              {template.headerLine}
            </div>
          )}
        </div>

        {/* ── 2. Input ────────────────────────────────────────────── */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="ad-label">2 · Tempel atau unggah CSV</div>
            <label className="ad-btn">
              <Upload width={14} height={14} strokeWidth={1.5} /> Dari file
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </label>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value)
              setFileName('')
              setPreview(null)
              setResult(null)
            }}
            placeholder={template ? template.headerLine + '\nNetflix Premium,Streaming,Akun premium 1 bulan,,45000,true' : 'name,category,...'}
            rows={6}
            className="ad-input font-mono text-xs leading-relaxed"
          />
          <button onClick={runPreview} disabled={previewLoading || csvText.trim() === ''} className="ad-btn ad-btn-dark mt-2">
            {previewLoading ? 'Memeriksa...' : 'Pratinjau'}
          </button>
        </div>

        {/* ── 3. Preview ──────────────────────────────────────────── */}
        {preview && (
          <div className="mt-4">
            <div className="ad-label mb-1.5">3 · Pratinjau</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <StatusChip tone="zinc">{preview.total} baris</StatusChip>
              <StatusChip tone="green">{preview.valid} valid</StatusChip>
              {preview.invalid > 0 && <StatusChip tone="red">{preview.invalid} bermasalah</StatusChip>}
              {preview.warnings > 0 && <StatusChip tone="amber">{preview.warnings} peringatan</StatusChip>}
              {preview.skipped > 0 && <StatusChip tone="zinc">{preview.skipped} kosong dilewati</StatusChip>}
            </div>

            {preview.decisions.length > 0 && (
              <DataTable columns={config.decisionColumns.map((c) => ({ label: c.label, className: c.className }))} empty={false}>
                {preview.decisions.slice(0, 8).map((d) => (
                  <tr key={String(d.row)}>
                    {config.decisionColumns.map((c) => (
                      <td key={c.label}>{c.render(d)}</td>
                    ))}
                  </tr>
                ))}
              </DataTable>
            )}
            {preview.decisions.length > 8 && (
              <div className="text-[11px] ad-num text-[#aeaeb2] mt-1">+ {preview.decisions.length - 8} baris valid lainnya</div>
            )}

            {preview.issues.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#1d1d1f]">
                    Masalah ({preview.issueTotal})
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setErrorsOnly((s) => !s)} className="ad-btn !py-1 !text-[11px]">
                      {errorsOnly ? 'Semua' : 'Hanya error'}
                    </button>
                    {preview.errorCsv && (
                      <button
                        onClick={() => download(`impor-${config.entity}-error.csv`, preview.errorCsv, 'text/csv;charset=utf-8')}
                        className="ad-btn !py-1 !text-[11px]"
                      >
                        <Download width={12} height={12} strokeWidth={1.5} /> Error CSV
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {shownIssues.map((e, i) => (
                    <div
                      key={`${e.row}-${e.code}-${i}`}
                      className={`rounded-[10px] px-3 py-2 text-xs ${e.severity === 'error' ? 'bg-[#fdecec] text-[#b91c1c]' : 'bg-[#fef3e2] text-[#92400e]'}`}
                    >
                      <span className="ad-num font-semibold">Baris {e.row}</span>
                      {e.column && <span> · {e.column}</span>} · {e.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {template && (
              <ul className="mt-3 text-[11px] text-[#aeaeb2] leading-relaxed list-disc pl-4">
                {template.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── 4. Commit ───────────────────────────────────────────── */}
        {result && (
          <div className="mt-3 rounded-[10px] px-3 py-2 text-xs bg-[#e7f6ec] text-[#15803d]">
            <span className="ad-num font-semibold">{result.committed}/{result.total} baris</span> tersimpan
            {result.replay ? ' (duplikat dicegah)' : ''}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="ad-btn">Tutup</button>
          <button onClick={runCommit} disabled={!canCommit} className="ad-btn ad-btn-dark">
            {committing ? 'Mengimpor...' : result ? 'Sudah diimpor' : `Impor ${preview?.valid || ''}`}
          </button>
        </div>
      </div>
    </dialog>
  )
}
