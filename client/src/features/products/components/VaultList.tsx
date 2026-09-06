import { useState, useMemo, useEffect, useRef } from 'react'
import SearchableSelect from '../../../components/admin/SearchableSelect'
import DataTable from '../../../components/admin/DataTable'
import CopyCell from '../../../components/admin/CopyCell'
import StatusChip from '../../../components/admin/StatusChip'
import ConfirmDialog, { openConfirm } from '../../../components/admin/ConfirmDialog'
import { useVaultManager } from '../hooks/useVaultManager'
import { authedApiRequest } from '../../../lib/api'
import type { Variant } from '../types'
import { Lock, LockSlash, Refresh, Copy, EditPencil, Trash, Prohibition, Redo, Search, NavArrowLeft, NavArrowRight, Plus } from 'iconoir-react'

interface Props { variants: Variant[]; fetchedAt: number | null; initialVariantId?: string | null; onVariantSelected?: () => void; /** Prefill order search (orders deep-link: jump straight to that order's credential). */ initialOrderId?: string | null; /** Open import dialog on preselect (create flow). Deep-links only preselect. */ autoImport?: boolean }

export default function VaultList({ variants, fetchedAt, initialVariantId, onVariantSelected, initialOrderId, autoImport = true }: Props) {
  const v = useVaultManager(variants)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string } | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<{ id: string } | null>(null)
  const [pendingRotate, setPendingRotate] = useState<{ orderId: string } | null>(null)
  const [rotateFallback, setRotateFallback] = useState<{ orderId: string; message: string } | null>(null)
  const [rotateCredential, setRotateCredential] = useState('')
  const [rotateFallbackVariantId, setRotateFallbackVariantId] = useState('')
  const [unlocking, setUnlocking] = useState(true)
  const [showImport, setShowImport] = useState(false)
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

  // Vault opens itself on mount — no manual gate. The 10-min token,
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
          </div>

          {/* ── Status bar ──────────────────────────────────────── */}
          <div className="flex items-center justify-between text-[12px] text-[#6e6e73]">
            <span className="ad-num">
              {v.loading ? 'Memuat...' : v.error ?? `${items.length} kredensial`}
              {fetchedAt && !v.loading && <span className="text-[#aeaeb2]"> · {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#aeaeb2] ad-num">Terkunci dalam {Math.floor(v.relockIn / 60)}:{String(v.relockIn % 60).padStart(2, '0')}</span>
              <button onClick={v.relock} title="Kunci ulang" className="ad-btn !px-2"><Lock width={14} height={14} strokeWidth={1.5} /></button>
              <button onClick={() => v.fetchList()} title="Muat ulang" className="ad-btn !px-2"><Refresh width={14} height={14} strokeWidth={1.5} /></button>
            </div>
          </div>

          {/* ── List ────────────────────────────────────────────── */}
          {v.variantId && !v.error && (
            <div className="ad-card">
              <DataTable
                columns={[{ label: 'KREDENSIAL' }, { label: 'STATUS', sortKey: 'status' }, { label: 'ORDER' }, { label: 'TANGGAL', sortKey: 'createdAt' }, { label: '', className: 'text-right' }]}
                empty={items.length === 0}
                emptyText="Tidak ada kredensial untuk varian ini."
                sortKey={v.sortKey}
                sortDir={v.sortDir}
                onSort={v.toggleSort}
              >
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <pre className="font-mono text-xs text-[#1d1d1f] whitespace-pre-wrap break-all max-w-[320px] select-all leading-relaxed">{item.credential}</pre>
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusChip status={item.status}>{item.status}</StatusChip>
                    </td>
                    <td>{item.orderPublicId ? <CopyCell value={item.orderPublicId} display={item.orderPublicId.slice(0, 8)} className="text-xs ad-num text-[#6e6e73]" /> : <span className="text-xs ad-num text-[#6e6e73]">-</span>}</td>
                    <td className="text-xs ad-num text-[#6e6e73] whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => copy(item.credential)} title="Salin" className="ad-btn !px-2"><Copy width={14} height={14} strokeWidth={1.5} /></button>
                        {item.status === 'AVAILABLE' && (
                          <>
                            <button onClick={() => setEditing({ id: item.id, text: item.credential })} title="Edit" className="ad-btn !px-2"><EditPencil width={14} height={14} strokeWidth={1.5} /></button>
                            <button onClick={() => { setPendingDelete({ id: item.id }); openConfirm('vault-delete') }} title="Hapus" className="ad-btn !px-2"><Trash width={14} height={14} strokeWidth={1.5} /></button>
                          </>
                        )}
                        {item.status === 'SOLD' && item.orderPublicId && (
                          <>
                            <button onClick={() => { setPendingRevoke({ id: item.id }); openConfirm('vault-revoke') }} title="Cabut saja" className="ad-btn !px-2"><Prohibition width={14} height={14} strokeWidth={1.5} /></button>
                            <button onClick={() => { setPendingRotate({ orderId: item.orderPublicId! }); openConfirm('vault-rotate') }} title="Cabut + ganti" className="ad-btn ad-btn-dark !px-2"><Redo width={14} height={14} strokeWidth={1.5} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#f1f1f4]">
                <span className="text-xs ad-num text-[#6e6e73]">{v.data?.total ?? 0} total</span>
                <div className="flex gap-1.5">
                  <button onClick={() => v.setPage((p) => Math.max(0, p - 1))} disabled={v.page === 0} className="ad-btn !px-2.5"><NavArrowLeft width={15} height={15} strokeWidth={1.5} /></button>
                  <button onClick={() => v.setPage((p) => p + 1)} disabled={!v.data?.hasMore} className="ad-btn !px-2.5"><NavArrowRight width={15} height={15} strokeWidth={1.5} /></button>
                </div>
              </div>
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
          <ConfirmDialog id="vault-rotate" title="Ganti kredensial?" message="Kredensial lama dicabut, yang baru dialokasikan ke order yang sama. Pelanggan akan melihat kredensial baru di dashboard." confirmLabel="Ya, ganti" onConfirm={async () => {
            if (!pendingRotate) return
            setPendingRotate(null)
            await v.rotateCred(pendingRotate.orderId)
            if (v.rotateError?.orderId === pendingRotate.orderId) {
              setRotateFallback({ orderId: pendingRotate.orderId, message: v.rotateError.message })
            }
          }} />

          {/* ── Rotate fallback dialog ───────────────────────────── */}
          {rotateFallback && (
            <dialog open className="modal" style={{ zIndex: 60 }}>
              <div className="modal-box ad-dialog max-w-lg p-6">
                <h3 className="font-semibold text-[17px] tracking-tight">Stok habis — pilih cara penggantian</h3>
                <p className="text-xs text-[#6e6e73] mt-1">Varian saat ini tidak punya stok tersedia. Kamu bisa memasukkan kredensial manual atau pilih varian lain.</p>
                <div className="mt-4 flex flex-col gap-3">
                  <label className="ad-input">
                    <span className="text-xs font-semibold mb-1 block">Kredensial manual (opsional)</span>
                    <textarea value={rotateCredential} onChange={(e) => setRotateCredential(e.target.value)} rows={4} placeholder="user@email.com:password123" className="font-mono text-xs" />
                  </label>
                  <label className="ad-input">
                    <span className="text-xs font-semibold mb-1 block">Varian cadangan (opsional)</span>
                    <select value={rotateFallbackVariantId} onChange={(e) => setRotateFallbackVariantId(e.target.value)} className="ad-input">
                      <option value="">Gunakan varian order asli</option>
                      {v.vaultOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => { setRotateFallback(null); setRotateCredential(''); setRotateFallbackVariantId('') }} className="ad-btn">Batal</button>
                  <button disabled={!rotateCredential.trim() && !rotateFallbackVariantId} onClick={async () => {
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
