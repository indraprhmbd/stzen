import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchableSelect from '../../../components/admin/SearchableSelect'
import DataTable from '../../../components/admin/DataTable'
import TablePagination from '../../../components/admin/TablePagination'
import TableSortMenu from '../../../components/admin/TableSortMenu'
import CopyCell from '../../../components/admin/CopyCell'
import StatusChip from '../../../components/admin/StatusChip'
import ConfirmDialog, { openConfirm } from '../../../components/admin/ConfirmDialog'
import AdminBulkBar from '../../../components/admin/AdminBulkBar'
import { useVaultManager } from '../hooks/useVaultManager'
import { useTableSort } from '../../../hooks/useTableSort'
import { useRowSelection } from '../../../hooks/useRowSelection'
import { SelectableRow, SelectAllCheckbox } from '../../../components/admin/RowSelection'
import { authedApiRequest } from '../../../lib/api'
import type { Variant } from '../types'
import { Lock, LockSlash, Refresh, Copy, EditPencil, Trash, Prohibition, Redo, Search, Plus, ArrowUpRightSquare, Download } from 'iconoir-react'
import BulkImportDialog, { stokBulkConfig } from './BulkImportDialog'

interface Props { variants: Variant[]; fetchedAt: number | null; initialVariantId?: string | null; onVariantSelected?: () => void; /** Prefill order search (orders deep-link: jump straight to that order's credential). */ initialOrderId?: string | null; /** Open import dialog on preselect (create flow). Deep-links only preselect. */ autoImport?: boolean }

// Shared by DataTable headers (desktop) and TableSortMenu (mobile <sm).
const vaultColumns = [
  { label: 'KREDENSIAL' },
  { label: 'STATUS', sortKey: 'status' },
  { label: 'ORDER' },
  { label: 'TANGGAL', sortKey: 'createdAt' },
  { label: '', className: 'text-right' },
]

export default function VaultList({ variants, fetchedAt, initialVariantId, onVariantSelected, initialOrderId, autoImport = true }: Props) {
  // Server-side sort persisted in URL (?sort&sort_dir), shared with the
  // desktop headers and the mobile sort menu. Page resets on sort change
  // (vault paging is local state, not URL).
  const { sortKey, sortDir, toggleSort: toggleUrlSort } = useTableSort([], { urlKey: 'sort_vault', defaultKey: 'createdAt', defaultDir: 'desc' })
  const v = useVaultManager(variants, sortKey ?? 'createdAt', sortDir ?? 'desc')
  function toggleSort(key: string) { v.setPage(0); toggleUrlSort(key) }
  const navigate = useNavigate()
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string } | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<{ id: string } | null>(null)
  const [pendingRotate, setPendingRotate] = useState<{ orderId: string } | null>(null)
  const [rotateFallback, setRotateFallback] = useState<{ orderId: string; message: string } | null>(null)
  const [rotateCredential, setRotateCredential] = useState('')
  const [rotateFallbackVariantId, setRotateFallbackVariantId] = useState('')
  const [unlocking, setUnlocking] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importLoading, setImportLoading] = useState(false)

  // Pre-select variant when navigating from create dialog or orders deep-link.
  // Orders deep-link also mounts the order id into the search box so the
  // list jumps straight to that order's credential.
  useEffect(() => {
    if (initialVariantId) {
      v.setVariantId(initialVariantId)
      if (initialOrderId) v.setQ(initialOrderId)
      if (autoImport) setShowImport(true)
      onVariantSelected?.()
    }
  }, [initialVariantId])

  // Vault opens itself on mount - no manual gate. The 10-min token,
  // hide-tab relock, and manual lock button still bound the session.
  const autoUnlocked = useRef(false)
  useEffect(() => {
    if (!autoUnlocked.current) {
      autoUnlocked.current = true
      v.unlock().finally(() => setUnlocking(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const importParsed = useMemo(() => {
    const lines: string[] = []
    importText.split('\n').forEach((raw) => {
      const line = raw.trim()
      if (line) lines.push(line)
    })
    return lines
  }, [importText])

  async function handleImport() {
    if (!v.variantId || importParsed.length === 0) { v.showToast('Pilih varian dan isi kredensial', 'error'); return }
    setImportLoading(true)
    try {
      const res = await authedApiRequest(
        (c) => c.api.v1.admin.variants[':id'].stock.$post({ param: { id: v.variantId }, json: { credentials: importText } })
      )
      const data = await res.json() as { imported?: number; error?: string }
      if (!res.ok || data.imported == null) throw new Error(data.error || 'Gagal impor')
      v.showToast(`${data.imported} kredensial diimpor`, 'success')
      setImportText(''); setShowImport(false)
      v.fetchList()
    } catch (e: unknown) {
      v.showToast(e instanceof Error ? e.message : 'Gagal impor', 'error')
    } finally { setImportLoading(false) }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    f.text().then((text) => {
      setImportText((prev) => prev.trim() ? prev.replace(/\s+$/, '') + '\n' + text.trim() : text.trim())
    }).catch(() => v.showToast('Gagal membaca file', 'error'))
  }

  const importTarget = variants.find((vr) => vr.id === v.variantId)

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => v.showToast('Disalin', 'success'),
      () => v.showToast('Gagal salin', 'error')
    )
  }

  const items = v.data?.items ?? []
  const counts = v.data?.counts ?? {}
  const available = counts['AVAILABLE'] ?? 0
  const sold = counts['SOLD'] ?? 0
  const revoked = counts['REVOKED'] ?? 0

  // Uniform bulk selection: checkbox column always visible, row-body clicks
  // toggle only once armed (credential <pre> taps stay text-selectable via
  // the shared guard). Clears on variant/search/page/sort change.
  const selection = useRowSelection()
  const pageIds = useMemo(() => items.map((item) => item.id), [items])
  useEffect(() => { selection.clear() }, [v.variantId, v.q, v.page, v.limit, sortKey, sortDir])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [pendingBulk, setPendingBulk] = useState<'delete' | 'revoke' | null>(null)

  async function runBulkVault(action: 'delete' | 'revoke') {
    const ids = selection.selected.slice(0, 100)
    if (bulkBusy || ids.length === 0) return
    setBulkBusy(true)
    setPendingBulk(null)
    try {
      const out = await v.bulkVault(action, ids)
      const verb = action === 'delete' ? 'Dihapus' : 'Dicabut'
      selection.clear()
      v.showToast(
        out.skipped.length === 0
          ? `${verb}: ${out.processed} kredensial`
          : `${verb} ${out.processed} dari ${out.scanned} - ${out.skipped.length} dilewati (${out.skipped[0]!.reason})`,
        out.processed > 0 ? 'success' : 'error'
      )
    } catch (e: unknown) {
      v.showToast(e instanceof Error ? e.message : 'Gagal memproses massal', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  function askBulkVault(action: 'delete' | 'revoke') {
    setPendingBulk(action)
    openConfirm(action === 'delete' ? 'vault-bulk-delete' : 'vault-bulk-revoke')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Unlock banner (retry fallback; vault opens itself) ─────── */}
      {!v.isUnlocked ? (
        <div className="ad-card-flat p-6 text-center">
          <Lock width={32} height={32} strokeWidth={1.5} className="mx-auto mb-3 text-[#aeaeb2]" />
          {unlocking ? (
            <div className="text-[13px] text-[#6e6e73]">Membuka vault...</div>
          ) : (
            <>
              <div className="text-[13px] text-[#6e6e73] mb-3">Gagal membuka vault otomatis.</div>
              <button onClick={() => { setUnlocking(true); v.unlock().finally(() => setUnlocking(false)) }} className="ad-btn ad-btn-dark">
                <LockSlash width={15} height={15} strokeWidth={1.5} />
                Coba Lagi
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* ── Toolbar ─────────────────────────────────────────── */}
          <div className="ad-card-flat p-3 flex flex-col sm:flex-row gap-3">
            <SearchableSelect
              value={v.variantId}
              onChange={v.setVariantId}
              placeholder="Pilih varian..."
              emptyText="Tidak ada varian"
              options={v.vaultOptions}
              className="flex-1"
            />
            {v.variantId && (
              <>
                <label className="ad-input flex items-center gap-2 flex-1">
                  <Search width={15} height={15} strokeWidth={1.5} className="shrink-0 text-[#aeaeb2]" />
                  <input placeholder="Cari order id..." value={v.q} onChange={(e) => { v.setQ(e.target.value); v.setPage(0) }} className="grow bg-transparent text-sm outline-none" />
                </label>
                <div className="flex flex-col gap-1">
                  <StatusChip tone="green">Tersedia {available}</StatusChip>
                  <StatusChip tone="blue">Terkirim {sold}</StatusChip>
                  {revoked > 0 && <StatusChip tone="red">Dicabut {revoked}</StatusChip>}
                </div>
                <button onClick={() => setShowImport(true)} className="ad-btn ad-btn-dark"><Plus width={15} height={15} strokeWidth={1.5} />Tambah</button>
              </>
            )}
            {/* Bulk CSV: refs travel in the file, so this stays visible
                with no variant selected. Distinct from Tambah (single). */}
            <button onClick={() => setShowBulkImport(true)} className="ad-btn"><Download width={15} height={15} strokeWidth={1.5} />Impor CSV</button>
          </div>

          {/* ── Status bar ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#6e6e73]">
            <span className="ad-num">
              {v.loading ? 'Memuat...' : v.error ?? `${items.length} kredensial`}
              {fetchedAt && !v.loading && <span className="text-[#aeaeb2]"> · {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
            </span>
            <span className="text-[11px] text-[#aeaeb2] ad-num ml-auto">Terkunci dalam {Math.floor(v.relockIn / 60)}:{String(v.relockIn % 60).padStart(2, '0')}</span>
            <div className="flex max-w-full items-center justify-start gap-2 overflow-x-auto *:shrink-0">
              <button onClick={v.relock} title="Kunci ulang" className="ad-btn"><Lock width={14} height={14} strokeWidth={1.5} /><span className="text-[11px]">Kunci</span></button>
              <button onClick={() => v.fetchList()} title="Muat ulang" className="ad-btn"><Refresh width={14} height={14} strokeWidth={1.5} /><span className="text-[11px]">Muat ulang</span></button>
              {/* Mobile: thead (and its select-all) hides below sm. */}
              {v.variantId && (
                <button onClick={() => selection.toggleAll(pageIds)} className="ad-btn sm:hidden">
                  {selection.headerState(pageIds) === 'all' ? 'Batal pilih' : 'Pilih semua'}
                </button>
              )}
              {v.variantId && <TableSortMenu columns={vaultColumns} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />}
            </div>
          </div>

          {/* ── Bulk bar ──────────────────────────────────────────── */}
          {v.variantId && (
            <AdminBulkBar
              count={selection.count}
              onClear={selection.clear}
              headerCheckboxId="vault-select-all"
              actions={
                <>
                  <button onClick={() => askBulkVault('delete')} disabled={bulkBusy} className="ad-btn ad-btn-danger w-full sm:w-auto">
                    {bulkBusy ? 'Memproses...' : `Hapus (${selection.count})`}
                  </button>
                  <button onClick={() => askBulkVault('revoke')} disabled={bulkBusy} className="ad-btn w-full sm:w-auto">
                    {bulkBusy ? 'Memproses...' : `Cabut (${selection.count})`}
                  </button>
                </>
              }
            />
          )}

          {/* ── List ────────────────────────────────────────────── */}
          {v.variantId && !v.error && (
            <div className="ad-card">
              <DataTable
                columns={vaultColumns}
                empty={items.length === 0}
                emptyText="Tidak ada kredensial untuk varian ini."
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                selectHeader={
                  <SelectAllCheckbox
                    id="vault-select-all"
                    label="Pilih semua kredensial di halaman ini"
                    state={selection.headerState(pageIds)}
                    onToggle={() => selection.toggleAll(pageIds)}
                  />
                }
              >
                {items.map((item) => (
                  <SelectableRow
                    key={item.id}
                    id={item.id}
                    selection={selection}
                    pageIds={pageIds}
                    selectLabel={`Pilih kredensial ${item.id.slice(0, 8)}`}
                  >
                    <td>
                      <pre className="font-mono text-xs text-[#1d1d1f] whitespace-pre-wrap break-all max-w-[320px] select-all leading-relaxed">{item.credential}</pre>
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusChip status={item.status}>{item.status}</StatusChip>
                    </td>
                    <td className="whitespace-nowrap">
                      {item.orderPublicId ? (
                        <div className="inline-flex items-center gap-1.5">
                          <CopyCell value={item.orderPublicId} display={item.orderPublicId.slice(0, 8)} className="text-xs ad-num text-[#6e6e73]" />
                          <button onClick={() => navigate(`/admin/orders?status=semua&q=${item.orderPublicId}`)} title="Lihat order" className="ad-btn"><ArrowUpRightSquare width={13} height={13} strokeWidth={1.5} /><span className="text-[11px]">Order</span></button>
                        </div>
                      ) : <span className="text-xs ad-num text-[#6e6e73]">-</span>}
                    </td>
                    <td className="text-xs ad-num text-[#6e6e73] whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                    <td className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1 *:whitespace-nowrap">
                        <button onClick={() => copy(item.credential)} title="Salin" className="ad-btn"><Copy width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Salin</span></button>
                        {item.status === 'AVAILABLE' && (
                          <>
                            <button onClick={() => setEditing({ id: item.id, text: item.credential })} title="Edit" className="ad-btn"><EditPencil width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Edit</span></button>
                            <button onClick={() => { setPendingDelete({ id: item.id }); openConfirm('vault-delete') }} title="Hapus" className="ad-btn"><Trash width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Hapus</span></button>
                          </>
                        )}
                        {item.status === 'SOLD' && item.orderPublicId && (
                          <>
                            <button onClick={() => { setPendingRevoke({ id: item.id }); openConfirm('vault-revoke') }} title="Cabut saja" className="ad-btn"><Prohibition width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Cabut</span></button>
                            {item.fulfillmentType === 'on_demand' ? (
                              <button onClick={() => { setPendingRotate({ orderId: item.orderPublicId! }); setRotateFallback({ orderId: item.orderPublicId!, message: 'ON_DEMAND_REQUIRES_CREDENTIAL' }); setPendingRotate(null) }} title="Ganti kredensial" className="ad-btn ad-btn-dark"><Redo width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Ganti</span></button>
                            ) : (
                              <button onClick={() => { setPendingRotate({ orderId: item.orderPublicId! }); openConfirm('vault-rotate') }} title="Cabut + ganti" className="ad-btn ad-btn-dark"><Redo width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Ganti</span></button>
                            )}
                          </>
                        )}
                        {item.status === 'AVAILABLE' && item.orderPublicId && (
                          <>
                            <button onClick={() => { setPendingRevoke({ id: item.id }); openConfirm('vault-revoke') }} title="Cabut saja" className="ad-btn"><Prohibition width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Cabut</span></button>
                            {item.fulfillmentType === 'on_demand' ? (
                              <button onClick={() => { setPendingRotate({ orderId: item.orderPublicId! }); setRotateFallback({ orderId: item.orderPublicId!, message: 'ON_DEMAND_REQUIRES_CREDENTIAL' }); setPendingRotate(null) }} title="Ganti kredensial" className="ad-btn ad-btn-dark"><Redo width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Ganti</span></button>
                            ) : (
                              <button onClick={() => { setPendingRotate({ orderId: item.orderPublicId! }); openConfirm('vault-rotate') }} title="Cabut + ganti" className="ad-btn ad-btn-dark"><Redo width={14} height={14} strokeWidth={1.5} /><span className="text-[10px]">Ganti</span></button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </SelectableRow>
                ))}
              </DataTable>
              <TablePagination
                total={v.data?.total ?? 0}
                limit={v.limit}
                offset={v.page * v.limit}
                onLimitChange={v.setLimit}
                onOffsetChange={(off) => v.setPage(Math.floor(off / v.limit))}
                unit="kredensial"
              />
            </div>
          )}

          {/* ── Edit dialog ─────────────────────────────────────── */}
          {editing && (
            <dialog open className="modal" style={{ zIndex: 60 }}>
              <div className="modal-box ad-dialog max-w-lg p-6">
                <h3 className="font-semibold text-[17px] tracking-tight">Edit Kredensial</h3>
                <p className="text-xs text-[#6e6e73] mt-1">Perubahan langsung terenkripsi ulang.</p>
                <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={6} className="ad-input mt-3 font-mono text-xs leading-relaxed" />
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setEditing(null)} className="ad-btn">Batal</button>
                  <button disabled={editing.text.trim() === '' || v.actionLoading === editing.id} onClick={async () => { await v.editCred(editing.id, editing.text.trim()); setEditing(null) }} className="ad-btn ad-btn-dark">Simpan</button>
                </div>
              </div>
            </dialog>
          )}

          {/* ── Confirm dialogs ─────────────────────────────────── */}
          <ConfirmDialog id="vault-delete" title="Hapus kredensial?" message="Kredensial AVAILABLE akan dihapus permanen." confirmLabel="Ya, hapus" onConfirm={() => { if (pendingDelete) v.deleteCred(pendingDelete.id); setPendingDelete(null) }} />
          <ConfirmDialog id="vault-revoke" title="Cabut kredensial?" message="Kredensial SOLD akan ditandai REVOKED tanpa penggantian." confirmLabel="Ya, cabut" onConfirm={() => { if (pendingRevoke) v.revokeCred(pendingRevoke.id); setPendingRevoke(null) }} />
          <ConfirmDialog
            id="vault-bulk-delete"
            title="Hapus kredensial terpilih?"
            message={pendingBulk === 'delete' ? `${selection.count} kredensial AVAILABLE yang belum pernah dialokasikan akan dihapus permanen. Baris SOLD/terikat order dilewati.` : ''}
            confirmLabel="Ya, hapus"
            onConfirm={() => pendingBulk === 'delete' && void runBulkVault('delete')}
          />
          <ConfirmDialog
            id="vault-bulk-revoke"
            title="Cabut kredensial terpilih?"
            message={pendingBulk === 'revoke' ? `${selection.count} kredensial SOLD/AVAILABLE terpilih ditandai REVOKED tanpa penggantian.` : ''}
            confirmLabel="Ya, cabut"
            onConfirm={() => pendingBulk === 'revoke' && void runBulkVault('revoke')}
          />
          <ConfirmDialog id="vault-rotate" title="Ganti kredensial?" message="Kredensial lama dicabut, yang baru dialokasikan ke order yang sama. Pelanggan akan melihat kredensial baru di dashboard." confirmLabel="Ya, ganti" onConfirm={async () => {
            if (!pendingRotate) return
            setPendingRotate(null)
            try {
              await v.rotateCred(pendingRotate.orderId)
            } catch (e) {
              setRotateFallback({ orderId: pendingRotate.orderId, message: e instanceof Error ? e.message : 'Gagal ganti' })
            }
          }} />

          {/* ── Rotate fallback dialog ───────────────────────────── */}
          {rotateFallback && (
            <dialog open className="modal" style={{ zIndex: 60 }}>
              <div className="modal-box ad-dialog max-w-lg p-6">
                <h3 className="font-semibold text-[17px] tracking-tight">
                  {rotateFallback.message === 'ON_DEMAND_REQUIRES_CREDENTIAL' ? 'Ganti kredensial on-demand' : 'Stok habis - pilih cara penggantian'}
                </h3>
                <p className="text-xs text-[#6e6e73] mt-1">
                  {rotateFallback.message === 'ON_DEMAND_REQUIRES_CREDENTIAL'
                    ? 'Varian ini menggunakan mode on-demand. Masukkan kredensial baru untuk order ini.'
                    : 'Varian saat ini tidak punya stok tersedia. Kamu bisa memasukkan kredensial manual atau pilih varian lain.'}
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <div>
                    <span className="text-xs font-semibold mb-1 block">
                      Kredensial manual {rotateFallback.message === 'ON_DEMAND_REQUIRES_CREDENTIAL' ? '(wajib)' : '(opsional)'}
                    </span>
                    <textarea value={rotateCredential} onChange={(e) => setRotateCredential(e.target.value)} rows={4} placeholder="user@email.com:password123" className="ad-input font-mono text-xs w-full" />
                  </div>
                  {rotateFallback.message !== 'ON_DEMAND_REQUIRES_CREDENTIAL' && (
                    <div>
                      <span className="text-xs font-semibold mb-1 block">Varian cadangan (opsional)</span>
                      <select value={rotateFallbackVariantId} onChange={(e) => setRotateFallbackVariantId(e.target.value)} className="ad-input">
                        <option value="">Gunakan varian order asli</option>
                        {v.vaultOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => { setRotateFallback(null); setRotateCredential(''); setRotateFallbackVariantId('') }} className="ad-btn">Batal</button>
                  <button disabled={rotateFallback.message === 'ON_DEMAND_REQUIRES_CREDENTIAL' ? !rotateCredential.trim() : (!rotateCredential.trim() && !rotateFallbackVariantId)} onClick={async () => {
                    const orderId = rotateFallback.orderId
                    setRotateFallback(null)
                    await v.rotateCred(orderId, { credential: rotateCredential.trim() || undefined, fallbackVariantId: rotateFallbackVariantId || undefined })
                    setRotateCredential(''); setRotateFallbackVariantId('')
                  }} className="ad-btn ad-btn-dark">Coba ganti</button>
                </div>
              </div>
            </dialog>
          )}

          {/* ── Import dialog ───────────────────────────────────── */}
          {showImport && (
            <dialog open className="modal" style={{ zIndex: 60 }}>
              <div className="modal-box ad-dialog max-w-lg p-6">
                <h3 className="font-semibold text-[17px] tracking-tight">Impor Kredensial</h3>
                <p className="text-xs text-[#6e6e73] mt-1">{importTarget?.name ?? 'Varian'}: satu kredensial per baris, format user:pass</p>
                <div className="mt-3 flex items-center justify-between">
                  <label className="ad-btn">Dari file<input type="file" accept=".txt,.csv,.log" className="hidden" onChange={handleImportFile} /></label>
                  {importText && <button onClick={() => setImportText('')} className="ad-btn">Bersihkan</button>}
                </div>
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="user@email.com:password123" rows={8} className="ad-input mt-3 font-mono text-xs leading-relaxed" />
                {importParsed.length > 0 && (
                  <div className="mt-2 rounded-[10px] px-3 py-2 text-xs bg-[#e7f6ec] text-[#15803d]">
                    <span className="ad-num font-semibold">{importParsed.length} baris</span> siap impor
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => { setShowImport(false); setImportText('') }} className="ad-btn">Batal</button>
                  <button disabled={importParsed.length === 0 || importLoading} onClick={handleImport} className="ad-btn ad-btn-dark">{importLoading ? 'Mengimpor...' : `Impor ${importParsed.length || ''}`}</button>
                </div>
              </div>
            </dialog>
          )}
          {/* ── Bulk CSV import (multi-variant; refs travel in file) ── */}
          <BulkImportDialog config={stokBulkConfig} open={showBulkImport} onClose={() => setShowBulkImport(false)} onDone={() => v.fetchList()} notify={v.showToast} />
        </>
      )}

      {/* ── Toast ───────────────────────────────────────────────── */}
      {v.toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999]">
          <div className={`px-4 py-2 rounded-[10px] text-sm font-medium ${v.toast.type === 'success' ? 'bg-[#1d1d1f] text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {v.toast.msg}
          </div>
        </div>
      )}
    </div>
  )
}
