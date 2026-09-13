import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authedApiRequest } from '../../lib/api'
import { useAdminQuery } from '../../hooks/useAdminQuery'
import DataTable from '../../components/admin/DataTable'
import StatusChip from '../../components/admin/StatusChip'
import { Refresh, ArrowUpRight } from 'iconoir-react'

// ─── Pengingat ──────────────────────────────────────────────────────────────
// Dedicated page for the provider-agnostic reminder system. Read-only
// preview of which live orders resolve to a future expiry, plus a manual
// backfill (preview-then-execute, DangerZone pattern) for orders paid
// before the feature shipped or while a channel was down.
// Non-destructive (creates external events only): no password re-auth.

interface PreviewRow {
  publicId: string
  productName: string
  status: string
  paidAt: string | null
  expiry: string | null
  durationSource: 'snapshot' | 'varian' | null
  eligible: boolean
  reason: string
}

interface BackfillResult {
  scanned: number
  scheduled: number
  skipped: number
}

function formatIdDate(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export default function Reminders() {
  const [limit, setLimit] = useState('10')
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)
  const [backfillBusy, setBackfillBusy] = useState(false)

  const { data, loading, error, fetchedAt, refetch } = useAdminQuery(async () => {
    const res = await authedApiRequest((c) =>
      c.api.v1.admin.reminders.preview.$get({ query: { limit: '50' } })
    )
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || `Gagal (${res.status})`)
    }
    return (await res.json()) as { rows: PreviewRow[] }
  }, [])
  const rows = data?.rows ?? []
  const eligible = rows.filter((r) => r.eligible)

  async function executeBackfill() {
    if (backfillBusy || eligible.length === 0) return
    setBackfillBusy(true)
    setBackfillMsg(null)
    try {
      const n = Math.min(20, Math.max(1, parseInt(limit, 10) || 10))
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.reminders.backfill.$post({ json: { limit: n } })
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || `Gagal (${res.status})`)
      }
      const out = (await res.json()) as BackfillResult
      setBackfillMsg(`Dijadwalkan: ${out.scheduled} dari ${out.scanned} dipindai (${out.skipped} dilewati)`)
      await refetch()
    } catch (e: unknown) {
      setBackfillMsg(e instanceof Error ? e.message : 'Gagal mengeksekusi')
    } finally {
      setBackfillBusy(false)
    }
  }

  if (error) return <div className="ad-card-flat p-8 text-center"><div className="text-sm font-semibold text-red-600">Gagal memuat</div><div className="text-xs text-[#6e6e73] mt-1">{error}</div><button onClick={refetch} className="ad-btn ad-btn-dark mt-4">Coba lagi</button></div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Pengingat</h1>
          {fetchedAt && <p className="text-[13px] text-[#aeaeb2] mt-0.5">Disinkron {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
        </div>
        <button onClick={refetch} title="Muat ulang" className="ad-btn">
          <Refresh width={15} height={15} strokeWidth={1.5} />
          Muat ulang
        </button>
      </div>

      <div className="ad-card p-5 flex flex-col gap-3">
        <div className="ad-card-title text-[#aeaeb2]">Isi ulang pengingat</div>
        <p className="text-[13px] text-[#6e6e73] leading-relaxed">
          Membuat event kalender untuk order lunas yang belum terjadwal (bayar sebelum fitur aktif atau saat kanal mati).
          Pratinjau di bawah menunjukkan {eligible.length} order siap dijadwalkan.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="ad-label">
            Batas per eksekusi (1-20)
            <input
              type="number"
              min={1}
              max={20}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="ad-input mt-1.5 ad-num sm:w-32"
            />
          </label>
          <button
            onClick={executeBackfill}
            disabled={backfillBusy || eligible.length === 0}
            className="ad-btn ad-btn-dark"
          >
            {backfillBusy ? 'Menjadwalkan...' : `Jadwalkan ${Math.min(eligible.length, Math.min(20, Math.max(1, parseInt(limit, 10) || 10)))} order`}
          </button>
        </div>
        {backfillMsg && <p className="text-xs font-semibold text-[#1d1d1f]">{backfillMsg}</p>}
      </div>

      <div className="ad-card-flat overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="ad-card-title text-[#aeaeb2]">Pratinjau order lunas ({rows.length})</div>
        </div>
        {loading ? (
          <p className="px-4 pb-4 text-[13px] text-[#aeaeb2]">Memuat...</p>
        ) : rows.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-[#aeaeb2]">Belum ada order lunas.</p>
        ) : (
          <DataTable
            columns={[{ label: 'ORDER' }, { label: 'PRODUK' }, { label: 'STATUS' }, { label: 'BAYAR' }, { label: 'KADALUARSA' }, { label: 'JADWAL' }]}
            empty={false}
            emptyText="Belum ada order lunas."
          >
            {rows.map((r) => (
              <tr key={r.publicId}>
                <td>
                  <Link
                    to={`/admin/orders?status=semua&q=${encodeURIComponent(r.publicId)}`}
                    title={`Buka ${r.publicId} di Pesanan`}
                    className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#1d1d1f] hover:underline"
                  >
                    {r.publicId}
                    <ArrowUpRight width={13} height={13} strokeWidth={2} className="text-[#aeaeb2]" />
                  </Link>
                </td>
                <td className="text-[13px]">{r.productName}</td>
                <td><StatusChip status={r.status}>{r.status}</StatusChip></td>
                <td className="text-[13px]">{formatIdDate(r.paidAt)}</td>
                <td className="text-[13px]" title={r.durationSource === 'varian' ? 'Durasi dari varian saat ini (order lama tanpa snapshot)' : undefined}>
                  {formatIdDate(r.expiry)}{r.durationSource === 'varian' ? ' *' : ''}
                </td>
                <td title={r.reason}>
                  <StatusChip tone={r.eligible ? 'blue' : 'zinc'}>{r.eligible ? 'Siap' : 'Lewati'}</StatusChip>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  )
}
