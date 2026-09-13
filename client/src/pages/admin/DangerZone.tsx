import { useState } from 'react'
import { authedApiRequest } from '../../lib/api'
import { usePasswordConfirm } from '../../hooks/usePasswordConfirm'

interface StalePreview {
  olderThanDays: number
  cutoff: string
  count: number
  sampleIds: string[]
}

interface CatalogPreview {
  publicId: string
  name: string
  variants: number
  vaultAvailable: number
  vaultSold: number
  ordersActive: number
  ordersTerminal: number
  blocked: boolean
  blockReason: string | null
}

interface PurgePreview {
  kind: string
  cutoff: string
  count: number
}

async function readJson(res: { ok: boolean; status: number; json: () => Promise<unknown> }): Promise<any> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Gagal (${res.status})`)
  }
  return res.json()
}

// ─── Danger Zone ────────────────────────────────────────────────────────────
// Tiered destructive ops. Every execute requires: preview count read first,
// exact typed phrase, and current-password re-auth via the input below
// (own usePasswordConfirm instance - independent of the Akun page).
// Results and errors stay inside each tier card.

export default function DangerZone() {
  const { pwCur, setPwCur, confirmCurrentPassword } = usePasswordConfirm()
  const [reauthMsg, setReauthMsg] = useState<string | null>(null)
  // Tier 1
  const [days, setDays] = useState('7')
  const [stale, setStale] = useState<StalePreview | null>(null)
  const [stalePhrase, setStalePhrase] = useState('')
  const [staleMsg, setStaleMsg] = useState<string | null>(null)
  const [staleBusy, setStaleBusy] = useState(false)

  // Tier 2
  const [prodId, setProdId] = useState('')
  const [prodPrev, setProdPrev] = useState<CatalogPreview | null>(null)
  const [prodPhrase, setProdPhrase] = useState('')
  const [prodMsg, setProdMsg] = useState<string | null>(null)
  const [prodBusy, setProdBusy] = useState(false)
  const [varId, setVarId] = useState('')
  const [varPrev, setVarPrev] = useState<CatalogPreview | null>(null)
  const [varPhrase, setVarPhrase] = useState('')
  const [varMsg, setVarMsg] = useState<string | null>(null)
  const [varBusy, setVarBusy] = useState(false)

  // Tier 3 (vault only: orders are never purgeable, UU KUP retention)
  const [purgePrev, setPurgePrev] = useState<PurgePreview | null>(null)
  const [exportToken, setExportToken] = useState<string | null>(null)
  const [purgePhrase, setPurgePhrase] = useState('')
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null)
  const [purgeBusy, setPurgeBusy] = useState(false)

  async function guard(): Promise<boolean> {
    setReauthMsg(null)
    return confirmCurrentPassword(setReauthMsg)
  }

  async function previewStale() {
    setStaleMsg(null)
    setStaleBusy(true)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.danger['stale-orders'].preview.$get({ query: { olderThanDays: Number(days) || 7 } })
      )
      setStale((await readJson(res)) as StalePreview)
    } catch (e: unknown) {
      setStaleMsg(e instanceof Error ? e.message : 'Gagal memuat pratinjau')
    } finally {
      setStaleBusy(false)
    }
  }

  async function executeStale() {
    if (stalePhrase !== 'TOLAK' || staleBusy) return
    if (!(await guard())) return
    setStaleBusy(true)
    setStaleMsg(null)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.danger['stale-orders'].reject.$post({
          json: { olderThanDays: Number(days) || 7, phrase: 'TOLAK' as const },
        })
      )
      const out = (await readJson(res)) as { rejected: number; skipped: number; hasMore: boolean }
      setStaleMsg(`Ditolak: ${out.rejected}, dilewati: ${out.skipped}${out.hasMore ? ' (masih ada sisa, ulangi)' : ''}`)
      setStalePhrase('')
      await previewStale()
    } catch (e: unknown) {
      setStaleMsg(e instanceof Error ? e.message : 'Gagal mengeksekusi')
    } finally {
      setStaleBusy(false)
    }
  }

  async function previewCatalog(kind: 'products' | 'variants') {
    const id = kind === 'products' ? prodId.trim() : varId.trim()
    if (!id) return
    if (kind === 'products') {
      setProdMsg(null)
      setProdBusy(true)
    } else {
      setVarMsg(null)
      setVarBusy(true)
    }
    try {
      const res = await authedApiRequest((c) =>
        kind === 'products'
          ? c.api.v1.admin.danger.products[':id'].preview.$get({ param: { id } })
          : c.api.v1.admin.danger.variants[':id'].preview.$get({ param: { id } })
      )
      const out = (await readJson(res)) as CatalogPreview
      if (kind === 'products') setProdPrev(out)
      else setVarPrev(out)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat pratinjau'
      if (kind === 'products') setProdMsg(msg)
      else setVarMsg(msg)
    } finally {
      if (kind === 'products') setProdBusy(false)
      else setVarBusy(false)
    }
  }

  async function executeCatalog(kind: 'products' | 'variants') {
    const id = kind === 'products' ? prodId.trim() : varId.trim()
    const phrase = kind === 'products' ? prodPhrase : varPhrase
    if (!id || phrase !== id) return
    if (!(await guard())) return
    const setBusy = kind === 'products' ? setProdBusy : setVarBusy
    const setMsg = kind === 'products' ? setProdMsg : setVarMsg
    setBusy(true)
    setMsg(null)
    try {
      const res = await authedApiRequest((c) =>
        kind === 'products'
          ? c.api.v1.admin.danger.products[':id'].$delete({ param: { id }, json: { phrase } })
          : c.api.v1.admin.danger.variants[':id'].$delete({ param: { id }, json: { phrase } })
      )
      const out = (await readJson(res)) as { name: string; variantsDeleted?: number }
      setMsg(`Dihapus: ${out.name}${out.variantsDeleted ? ` + ${out.variantsDeleted} varian` : ''}`)
      if (kind === 'products') {
        setProdPhrase('')
        setProdPrev(null)
        setProdId('')
      } else {
        setVarPhrase('')
        setVarPrev(null)
        setVarId('')
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengeksekusi')
    } finally {
      setBusy(false)
    }
  }

  async function previewPurge() {
    setPurgeMsg(null)
    setPurgeBusy(true)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.danger.purge.preview.$get()
      )
      setPurgePrev((await readJson(res)) as PurgePreview)
    } catch (e: unknown) {
      setPurgeMsg(e instanceof Error ? e.message : 'Gagal memuat pratinjau')
    } finally {
      setPurgeBusy(false)
    }
  }

  async function executeExport() {
    if (purgeBusy) return
    if (!(await guard())) return
    setPurgeBusy(true)
    setPurgeMsg(null)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.danger.export.$post({ json: { kind: 'vault' as const } })
      )
      const out = (await readJson(res)) as { csv: string; exportToken: string; count: number; truncated: boolean }
      const blob = new Blob([out.csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `danger-export-vault-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setExportToken(out.exportToken)
      setPurgeMsg(`Diekspor ${out.count} baris${out.truncated ? ' (dipotong, 5000 maks)' : ''}. CSV terunduh, purge terbuka 15 menit.`)
    } catch (e: unknown) {
      setPurgeMsg(e instanceof Error ? e.message : 'Gagal mengekspor')
    } finally {
      setPurgeBusy(false)
    }
  }

  async function executePurge() {
    if (!exportToken || purgePhrase !== 'HAPUS PERMANEN' || purgeBusy) return
    if (!(await guard())) return
    setPurgeBusy(true)
    setPurgeMsg(null)
    try {
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.danger.purge.$post({
          json: { exportToken, phrase: 'HAPUS PERMANEN' as const },
        })
      )
      const out = (await readJson(res)) as { kind: string; deleted: number }
      setPurgeMsg(`Purge selesai: ${out.deleted} baris ${out.kind} dihapus permanen.`)
      setExportToken(null)
      setPurgePhrase('')
      await previewPurge()
    } catch (e: unknown) {
      setPurgeMsg(e instanceof Error ? e.message : 'Gagal purge')
    } finally {
      setPurgeBusy(false)
    }
  }

  return (
    <div className="ad-card p-5 flex flex-col gap-5 md:col-span-2 border-2 border-red-600">
      <div>
        <div className="ad-card-title text-red-600">Danger Zone</div>
        <p className="text-[11px] text-[#6e6e73] mt-1">Tindakan di bawah ini permanen dan tercatat di Riwayat. Isi kata sandi saat ini di bawah sebelum eksekusi.</p>
        <label className="ad-label mt-2 block max-w-xs">
          Kata sandi saat ini
          <input type="password" value={pwCur} onChange={(e) => setPwCur(e.target.value)} placeholder="Konfirmasi untuk setiap eksekusi" autoComplete="current-password" className="ad-input mt-1.5" />
        </label>
        {reauthMsg && <p className="text-xs font-semibold text-red-600 mt-1">{reauthMsg}</p>}
      </div>

      {/* Tier 1 */}
      <section className="flex flex-col gap-2 border-t border-[#e5e5ea] pt-4">
        <div className="text-[13px] font-bold">Tier 1: Tolak pesanan basi</div>
        <p className="text-[11px] text-[#6e6e73]">Menolak massal pesanan PENDING tanpa payment_ref yang lebih tua dari N hari. Tanpa uang atau kredensial bergerak.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="ad-label">
            Lebih tua dari (hari)
            <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className="ad-input mt-1.5 ad-num w-28" />
          </label>
          <button onClick={previewStale} disabled={staleBusy} className="ad-btn ad-btn-dark !py-1.5 !text-xs">{staleBusy ? 'Memuat...' : 'Pratinjau'}</button>
        </div>
        {stale && <p className="text-xs font-semibold">Ditemukan: {stale.count} pesanan{stale.sampleIds.length > 0 && ` (contoh: ${stale.sampleIds.slice(0, 3).join(', ')})`}</p>}
        <div className="flex flex-wrap items-end gap-2">
          <label className="ad-label">
            Ketik TOLAK untuk konfirmasi
            <input type="text" value={stalePhrase} onChange={(e) => setStalePhrase(e.target.value)} placeholder="TOLAK" className="ad-input mt-1.5 font-mono w-40" />
          </label>
          <button onClick={executeStale} disabled={staleBusy || stalePhrase !== 'TOLAK' || !stale || stale.count === 0} className="ad-btn ad-btn-danger !py-1.5 !text-xs">Tolak massal</button>
        </div>
        {staleMsg && <p className="text-xs font-semibold">{staleMsg}</p>}
      </section>

      {/* Tier 2 */}
      <section className="flex flex-col gap-3 border-t border-[#e5e5ea] pt-4">
        <div className="text-[13px] font-bold">Tier 2: Hapus produk / varian</div>
        <p className="text-[11px] text-[#6e6e73]">Hapus permanen hanya bila tanpa riwayat apa pun (nol pesanan, nol stok). Selama masih ada jejak, nonaktifkan dari tab Produk. Ketik public_id persis seperti pratinjau untuk konfirmasi.</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="ad-label">
              Public ID produk
              <input type="text" value={prodId} onChange={(e) => setProdId(e.target.value)} placeholder="prod_..." className="ad-input mt-1.5 font-mono" />
            </label>
            <button onClick={() => previewCatalog('products')} disabled={prodBusy || !prodId.trim()} className="ad-btn ad-btn-dark !py-1.5 !text-xs">Pratinjau</button>
          </div>
          {prodPrev && (
            <p className="text-xs font-semibold">
              {prodPrev.name}: {prodPrev.variants} varian, stok {prodPrev.vaultAvailable}, terjual {prodPrev.vaultSold}, aktif {prodPrev.ordersActive}, terminal {prodPrev.ordersTerminal}
              {prodPrev.blocked && <span className="text-red-600"> - {prodPrev.blockReason}</span>}
            </p>
          )}
          {!prodPrev?.blocked && prodPrev && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="ad-label">
                Ketik public_id untuk konfirmasi
                <input type="text" value={prodPhrase} onChange={(e) => setProdPhrase(e.target.value)} placeholder={prodPrev.publicId} className="ad-input mt-1.5 font-mono" />
              </label>
              <button onClick={() => executeCatalog('products')} disabled={prodBusy || prodPhrase !== prodPrev.publicId} className="ad-btn ad-btn-danger !py-1.5 !text-xs">Hapus produk</button>
            </div>
          )}
          {prodMsg && <p className="text-xs font-semibold">{prodMsg}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="ad-label">
              Public ID varian
              <input type="text" value={varId} onChange={(e) => setVarId(e.target.value)} placeholder="var_..." className="ad-input mt-1.5 font-mono" />
            </label>
            <button onClick={() => previewCatalog('variants')} disabled={varBusy || !varId.trim()} className="ad-btn ad-btn-dark !py-1.5 !text-xs">Pratinjau</button>
          </div>
          {varPrev && (
            <p className="text-xs font-semibold">
              {varPrev.name}: stok {varPrev.vaultAvailable}, terjual {varPrev.vaultSold}, aktif {varPrev.ordersActive}, terminal {varPrev.ordersTerminal}
              {varPrev.blocked && <span className="text-red-600"> - {varPrev.blockReason}</span>}
            </p>
          )}
          {!varPrev?.blocked && varPrev && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="ad-label">
                Ketik public_id untuk konfirmasi
                <input type="text" value={varPhrase} onChange={(e) => setVarPhrase(e.target.value)} placeholder={varPrev.publicId} className="ad-input mt-1.5 font-mono" />
              </label>
              <button onClick={() => executeCatalog('variants')} disabled={varBusy || varPhrase !== varPrev.publicId} className="ad-btn ad-btn-danger !py-1.5 !text-xs">Hapus varian</button>
            </div>
          )}
          {varMsg && <p className="text-xs font-semibold">{varMsg}</p>}
        </div>
      </section>

      {/* Tier 3 */}
      <section className="flex flex-col gap-2 border-t border-[#e5e5ea] pt-4">
        <div className="text-[13px] font-bold">Tier 3: Purge stok basi (wajib ekspor dulu)</div>
        <p className="text-[11px] text-[#6e6e73]">Hanya stok AVAILABLE di atas 180 hari. Pesanan tidak pernah di purge (arsip pajak 10 tahun). Tombol purge hanya terbuka setelah ekspor CSV (token sekali pakai, 15 menit).</p>
        <div className="flex flex-wrap items-end gap-2">
          <button onClick={previewPurge} disabled={purgeBusy} className="ad-btn ad-btn-dark !py-1.5 !text-xs">Pratinjau</button>
        </div>
        {purgePrev && <p className="text-xs font-semibold">Ditemukan: {purgePrev.count} baris stok basi</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={executeExport} disabled={purgeBusy || !purgePrev || purgePrev.count === 0} className="ad-btn ad-btn-dark !py-1.5 !text-xs">1. Ekspor CSV</button>
        </div>
        {exportToken && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="ad-label">
              Ketik HAPUS PERMANEN untuk konfirmasi
              <input type="text" value={purgePhrase} onChange={(e) => setPurgePhrase(e.target.value)} placeholder="HAPUS PERMANEN" className="ad-input mt-1.5 font-mono" />
            </label>
            <button onClick={executePurge} disabled={purgeBusy || purgePhrase !== 'HAPUS PERMANEN'} className="ad-btn ad-btn-danger !py-1.5 !text-xs">2. Purge permanen</button>
          </div>
        )}
        {purgeMsg && <p className="text-xs font-semibold">{purgeMsg}</p>}
      </section>
    </div>
  )
}
