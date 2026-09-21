import StatusChip from '../../../components/admin/StatusChip'
import RupiahInput from '../../../components/admin/RupiahInput'
import { Search } from 'iconoir-react'
import { formatIdNumber } from '../../../lib/format'
import type { AdminOrder } from './types'
import { refundTierLabel } from './types'
import type { ManualOrderApi } from './useManualOrder'
import type { RefundCalcApi } from './useRefundCalc'
import { timelineActionLabel } from './useOrderRowActions'

export function ReceiptDialog(props: {
  receipt: AdminOrder | null
  onPrint: () => void
}) {
  const { receipt } = props
  return (
    <dialog id="receipt_modal" className="modal">
      <div className="modal-box ad-dialog max-w-md p-6">
        <h3 className="font-semibold text-[17px] tracking-tight">Struk</h3>
        {receipt && (
          <div className="mt-4 text-sm ad-num flex flex-col gap-1.5">
            <div className="flex justify-between"><span className="text-[#6e6e73]">ID</span><span className="font-semibold">{receipt.id.slice(0, 8).toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-[#6e6e73]">Tanggal</span><span>{new Date(receipt.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Produk</span><span className="text-right font-medium">{receipt.productName}</span></div>
            <div className="flex justify-between"><span className="text-[#6e6e73]">Jumlah</span><span className="font-semibold">Rp {formatIdNumber(receipt.amount)}</span></div>
            <div className="flex justify-between"><span className="text-[#6e6e73]">Status</span><span>{receipt.status}</span></div>
            <div className="flex justify-between"><span className="text-[#6e6e73]">Ref</span><span>{receipt.paymentRef ?? '-'}</span></div>
            {(receipt.customerAccount || receipt.waNumber) && (
              <>
                {receipt.customerAccount && <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Akun</span><span className="text-right font-medium break-all">{receipt.customerAccount}</span></div>}
                {receipt.waNumber && <div className="flex justify-between"><span className="text-[#6e6e73]">WA</span><span className="font-mono font-semibold">+{receipt.waNumber}</span></div>}
              </>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => (document.getElementById('receipt_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Tutup</button>
          <button onClick={props.onPrint} className="ad-btn ad-btn-dark">Cetak</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}

export function ManualOrderDialog(props: { m: ManualOrderApi }) {
  const { m } = props
  return (
    <dialog id="manual_modal" className="modal">
      <div className="modal-box ad-dialog max-w-md p-6">
        {m.mStep === 1 ? (
          <>
            <h3 className="font-semibold text-[17px] tracking-tight">{m.mReview ? 'Review Pesanan Manual' : 'Buat Pesanan Manual'}</h3>
            <p className="text-xs text-[#6e6e73] mt-1">{m.mReview ? 'Periksa harga + kontak, konfirmasi untuk setujui + alokasi.' : 'Pesanan tercatat PENDING - setujui dari antrean untuk alokasi stok.'}</p>
            <form onSubmit={m.mReview ? m.submitReview : m.submitManual} className="flex flex-col gap-4 mt-5">
              <label className="ad-label">Email Pelanggan
                <input type="email" required disabled={m.mReview !== null} value={m.mEmail} onChange={(e) => m.setMEmail(e.target.value)} placeholder="pelanggan@email.com" className="ad-input mt-1.5 normal-case" />
                <span className="text-[11px] text-[#aeaeb2] mt-1 normal-case font-normal">{m.mReview ? 'Pemilik pesanan (terkunci).' : 'Harus sudah terdaftar (punya akun).'}</span>
              </label>
              <div>
                <span className="ad-label">Varian</span>
                <div className="relative mt-1.5">
                  <input
                    type="text"
                    disabled={m.mReview !== null}
                    value={m.mSelected ? `${m.mSelected.name} - Rp ${formatIdNumber(m.mSelected.price)}` : m.mReview ? m.mReview.productName : m.mSearch}
                    onChange={(e) => { m.setMVariantId(''); m.setMSearch(e.target.value) }}
                    onFocus={() => { if (m.mSelected) { m.setMSearch(''); m.setMVariantId('') } }}
                    placeholder="Ketik untuk cari varian..."
                    className="ad-input normal-case pr-9"
                  />
                  <Search width={15} height={15} strokeWidth={1.5} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aeaeb2] pointer-events-none" />
                </div>
                {!m.mSelected && !m.mReview && (
                  <div className="mt-1.5 max-h-44 overflow-y-auto rounded-[10px] border border-[#e8e8ed]">
                    {m.mFiltered.length === 0 ? (
                      <p className="text-xs text-[#aeaeb2] px-3 py-2.5">Tidak ada varian cocok.</p>
                    ) : (
                      m.mFiltered.slice(0, 30).map((v) => (
                        <button
                          type="button"
                          key={v.id}
                          onClick={() => { m.setMVariantId(v.id); m.setMSearch('') }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#f5f5f7] border-b border-[#f4f4f5] last:border-0"
                        >
                          <span className="text-[13px] font-medium truncate">{v.name}</span>
                          <span className="ad-num text-xs font-semibold shrink-0">Rp {formatIdNumber(v.price)}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {m.mSelected && (
                <div className="rounded-[10px] border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={m.mUseCustom} onChange={(e) => { m.setMUseCustom(e.target.checked); m.setMCustomPrice('') }} className="checkbox checkbox-sm" />
                    <span className="text-xs font-semibold">Harga berbeda dari katalog</span>
                  </label>
                  {m.mUseCustom && (
                    <div className="mt-2">
                      <RupiahInput label="Harga final (Rp)" required value={m.mCustomPrice} onChange={m.setMCustomPrice} placeholder={m.mCatalogPrice} />
                    </div>
                  )}
                </div>
              )}
              <label className="ad-label">Ref Bayar (opsional)<input type="text" value={m.mPaymentRef} onChange={(e) => m.setMPaymentRef(e.target.value)} placeholder="tunai / transfer ..." className="ad-input mt-1.5 normal-case" /></label>
              <div className="-mt-2 flex max-w-full gap-1.5 overflow-x-auto pb-0.5 *:shrink-0">
                {['SEABANK', 'QRIS', 'TF BANK', 'TUNAI'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => m.setMPaymentRef(r)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide transition-colors ${m.mPaymentRef === r ? 'border-black bg-black text-white' : 'border-[#e0e0e6] bg-white text-[#6e6e73] hover:border-black hover:text-black'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="ad-label">Akun Tujuan{m.mSelected?.requiresDeliveryInfo ? ' *' : ''}
                  <input type="text" value={m.mAccount} onChange={(e) => m.setMAccount(e.target.value)} placeholder="email / username tujuan" className="ad-input mt-1.5 normal-case" />
                </label>
                <label className="ad-label">No. WA{m.mSelected?.requiresDeliveryInfo ? ' *' : ''}
                  <input type="tel" value={m.mWa} onChange={(e) => m.setMWa(e.target.value)} placeholder="08..." className="ad-input mt-1.5 normal-case" />
                </label>
              </div>
              {m.mSelected?.requiresDeliveryInfo && <p className="text-[11px] text-[#aeaeb2] -mt-2">Varian ini wajib info pengiriman.</p>}
              {m.mSelected && (
                <div className="ad-num text-[13px] border-t-2 border-dashed border-[#e8e8ed] pt-3 flex flex-col gap-1.5">
                  <div className="text-[11px] font-bold tracking-wider text-[#aeaeb2]">PRATINJAU STRUK</div>
                  <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Varian</span><span className="text-right font-medium normal-case">{m.mSelected.name}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Pelanggan</span><span className="text-right truncate normal-case">{m.mEmail || '-'}</span></div>
                  {m.mUseCustom && m.mFinalPrice ? (
                    <>
                      <div className="flex justify-between"><span className="text-[#6e6e73]">Katalog</span><s className="text-[#aeaeb2]">Rp {formatIdNumber(m.mCatalogPrice)}</s></div>
                      <div className="flex justify-between"><span className="text-[#6e6e73]">Harga final</span><span className="font-semibold">Rp {formatIdNumber(m.mFinalPrice)}</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between"><span className="text-[#6e6e73]">Harga</span><span className="font-semibold">Rp {formatIdNumber(m.mCatalogPrice)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-[#6e6e73]">Ref</span><span className="normal-case">{m.mPaymentRef || '-'}</span></div>
                  {(m.mAccount || m.mWa) && (
                    <>
                      {m.mAccount && <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Akun</span><span className="text-right font-medium break-all normal-case">{m.mAccount}</span></div>}
                      {m.mWa && <div className="flex justify-between"><span className="text-[#6e6e73]">WA</span><span className="font-mono font-semibold">+{m.mWa}</span></div>}
                    </>
                  )}
                </div>
              )}
              {m.mError && <p className="text-xs font-semibold text-red-600">{m.mError}</p>}
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => (document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Batal</button>
                <button type="submit" disabled={m.mSaving || !m.mSelected || (m.mUseCustom && !m.mCustomPrice)} className="ad-btn ad-btn-dark">{m.mSaving ? 'Menyimpan...' : m.mReview ? 'Setujui & Alokasikan' : 'Buat Pesanan'}</button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-[17px] tracking-tight">Pesanan Dibuat</h3>
            {m.mCreated && (
              <div className="mt-4 text-sm ad-num flex flex-col gap-1.5">
                <div className="flex justify-between"><span className="text-[#6e6e73]">ID</span><span className="font-semibold">{m.mCreated.id.slice(0, 8).toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-[#6e6e73]">Tanggal</span><span>{new Date(m.mCreated.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Produk</span><span className="text-right font-medium normal-case">{m.mCreated.productName}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#6e6e73]">Pelanggan</span><span className="text-right truncate normal-case">{m.mEmail}</span></div>
                <div className="flex justify-between"><span className="text-[#6e6e73]">Jumlah</span><span className="font-semibold">Rp {formatIdNumber(m.mCreated.amount)}</span></div>
                <div className="flex justify-between"><span className="text-[#6e6e73]">Status</span><StatusChip status={m.mCreated.status}>{m.mCreated.status}</StatusChip></div>
                <div className="flex justify-between"><span className="text-[#6e6e73]">Ref</span><span className="normal-case">{m.mPaymentRef || '-'}</span></div>
              </div>
            )}
            {m.mError && <p className="text-xs font-semibold text-red-600 mt-3">{m.mError}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => { m.resetManualForm() }} className="ad-btn">Buat Lagi</button>
              <button type="button" onClick={() => (document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()} className="ad-btn ad-btn-dark">Selesai</button>
            </div>
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}

export function RefundCalcDialog(props: { c: RefundCalcApi }) {
  const { c } = props
  return (
    <dialog id="refund_calc_modal" className="modal">
      <div className="modal-box ad-dialog max-w-md p-6">
        <h3 className="font-semibold text-[17px] tracking-tight">Hitung Refund</h3>
        <p className="text-xs text-[#6e6e73] mt-1">{c.calcOrder ? `${c.calcOrder.productName} · ${c.calcOrder.id.slice(0, 8).toUpperCase()}` : ''}</p>
        {c.calcLoading ? (
          <div className="py-8"><div className="h-9 w-full animate-pulse rounded-[8px] bg-[#f1f1f4]" /></div>
        ) : c.calcErr ? (
          <p className="text-xs font-semibold text-red-600 mt-4">{c.calcErr}</p>
        ) : c.calcData && (
          <div className="mt-4 text-sm ad-num flex flex-col gap-1.5">
            <div className="flex justify-between"><span className="text-[#6e6e73]">Harga beli</span><span className="font-semibold">Rp {formatIdNumber(c.calcData.amount)}</span></div>
            {c.calcData.preview ? (
              <>
                <div className="flex justify-between"><span className="text-[#6e6e73]">Total durasi</span><span>{c.calcData.preview.totalDays} hari</span></div>
                <div className="flex justify-between"><span className="text-[#6e6e73]">Terpakai</span><span>{c.calcData.preview.usedDays.toFixed(1)} hari</span></div>
                <div className="flex justify-between"><span className="text-[#6e6e73]">Sisa</span><span>{c.calcData.preview.remainingDays.toFixed(1)} hari</span></div>
                <div className="flex justify-between"><span className="text-[#6e6e73]">Klaim garansi</span><span>{c.calcData.claimCount}x · {refundTierLabel[c.calcData.preview.tier] ?? c.calcData.preview.tier} (×{c.calcData.preview.fee})</span></div>
                <div className="flex justify-between border-t-2 border-dashed border-[#e8e8ed] pt-2 mt-1"><span className="font-semibold">Refund</span><span className="font-semibold text-[#dc2626]">Rp {formatIdNumber(c.calcData.preview.refund)}</span></div>
              </>
            ) : (
              <div className="flex justify-between border-t-2 border-dashed border-[#e8e8ed] pt-2 mt-1"><span className="font-semibold">Refund penuh</span><span className="font-semibold text-[#dc2626]">Rp {formatIdNumber(c.calcData.amount)}</span></div>
            )}
            {c.calcData.claims.length > 0 && (
              <div className="mt-2 rounded-[10px] border border-[#e8e8ed] max-h-32 overflow-y-auto">
                {c.calcData.claims.map((cl) => (
                  <div key={cl.id} className="px-3 py-2 border-b border-[#f4f4f5] last:border-0 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium truncate">{cl.note || 'Rotasi kredensial'}</span>
                      <span className="text-[#aeaeb2] shrink-0">{new Date(cl.claimedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {cl.actorEmail && <div className="text-[#aeaeb2] truncate">{cl.actorEmail}</div>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <input type="text" value={c.claimNote} onChange={(e) => c.setClaimNote(e.target.value)} placeholder="Catatan klaim (opsional)" maxLength={500} className="ad-input normal-case flex-1" />
              <button onClick={() => void c.submitClaim()} disabled={c.claimSaving} className="ad-btn shrink-0">{c.claimSaving ? '...' : 'Catat klaim'}</button>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => (document.getElementById('refund_calc_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Tutup</button>
          <button onClick={c.applyCalcRefund} disabled={!c.calcData || (c.calcData.status !== 'PAID' && c.calcData.status !== 'DELIVERED')} className="ad-btn ad-btn-danger">Lanjut ke Refund</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}

export function TimelineDialog(props: {
  timelineOrder: AdminOrder | null
  timelineRows: { action: string; actor_email: string | null; created_at: string; snapshot_text: string }[]
  timelineNotes: { id: string; note: string; actorEmail: string | null; createdAt: string }[]
  timelineLoading: boolean
  timelineErr: string | null
  timelineNote: string
  setTimelineNote: (v: string) => void
  timelineNoteSaving: boolean
  addTimelineNote: () => void
}) {
  const { timelineOrder, timelineRows, timelineNotes, timelineLoading, timelineErr, timelineNote, setTimelineNote, timelineNoteSaving, addTimelineNote } = props
  return (
    <dialog id="order_timeline_modal" className="modal">
      <div className="modal-box ad-dialog max-w-md p-6">
        <h3 className="font-semibold text-[17px] tracking-tight">Riwayat Pesanan</h3>
        <p className="text-xs text-[#6e6e73] mt-1">{timelineOrder ? `${timelineOrder.productName} · ${timelineOrder.id.slice(0, 8).toUpperCase()}` : ''}</p>
        {timelineLoading ? (
          <div className="py-8"><div className="h-9 w-full animate-pulse rounded-[8px] bg-[#f1f1f4]" /></div>
        ) : timelineErr ? (
          <p className="text-xs font-semibold text-red-600 mt-4">{timelineErr}</p>
        ) : timelineRows.length === 0 && timelineNotes.length === 0 ? (
          <p className="text-xs text-[#aeaeb2] mt-4">Belum ada peristiwa tercatat.</p>
        ) : (
          <>
          {timelineNotes.length > 0 && (
            <div className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50/50 max-h-40 overflow-y-auto">
              {timelineNotes.map((n) => (
                <div key={n.id} className="px-3 py-2 border-b border-amber-100 last:border-0 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-amber-800">Catatan</span>
                    <span className="text-[#aeaeb2] shrink-0 ad-num">{new Date(n.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="text-[#3a3a3c] mt-0.5 break-words">{n.note}</div>
                  {n.actorEmail && <div className="text-[#aeaeb2] truncate">{n.actorEmail}</div>}
                </div>
              ))}
            </div>
          )}
          {timelineRows.length > 0 && (
          <div className="mt-4 rounded-[10px] border border-[#e8e8ed] max-h-80 overflow-y-auto">
            {timelineRows.map((t, i) => (
              <div key={i} className="px-3 py-2 border-b border-[#f4f4f5] last:border-0 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{timelineActionLabel[t.action] ?? t.action}</span>
                  <span className="text-[#aeaeb2] shrink-0 ad-num">{new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="text-[#6e6e73] mt-0.5 break-words">{t.snapshot_text}</div>
                {t.actor_email && <div className="text-[#aeaeb2] truncate">{t.actor_email}</div>}
              </div>
            ))}
          </div>
          )}
          <div className="flex gap-2 mt-3">
            <input type="text" value={timelineNote} onChange={(e) => setTimelineNote(e.target.value)} placeholder="Tambah catatan operator..." maxLength={500} className="ad-input normal-case flex-1" />
            <button onClick={addTimelineNote} disabled={timelineNoteSaving || !timelineNote.trim()} className="ad-btn shrink-0">{timelineNoteSaving ? '...' : 'Catat'}</button>
          </div>
          </>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => (document.getElementById('order_timeline_modal') as HTMLDialogElement | null)?.close()} className="ad-btn">Tutup</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}
