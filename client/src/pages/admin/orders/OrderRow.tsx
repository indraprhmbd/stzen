import { useNavigate } from 'react-router-dom'
import CopyCell from '../../../components/admin/CopyCell'
import StatusChip from '../../../components/admin/StatusChip'
import RowActionsMenu from '../../../components/admin/RowActionsMenu'
import { SelectableRow } from '../../../components/admin/RowSelection'
import { Key, EditPencil, Trash, Notes, Calculator, Send, Undo, Clock } from 'iconoir-react'
import { formatIdNumber } from '../../../lib/format'
import type { AdminOrder } from './types'
import { formatAge, blockedReason } from './types'

export interface OrderRowActions {
  actionLoading: string | null
  openReview: (o: AdminOrder) => void
  approveDirect: (id: string) => void
  askDeliver: (o: AdminOrder) => void
  askReject: (o: AdminOrder) => void
  openCalculator: (o: AdminOrder) => void
  askRefund: (o: AdminOrder) => void
  openReceipt: (o: AdminOrder) => void
  openTimeline: (o: AdminOrder) => void
}

export default function OrderRow(props: {
  o: AdminOrder
  pageIds: string[]
  selection: any
  actions: OrderRowActions
}) {
  const { o, pageIds, selection, actions } = props
  const navigate = useNavigate()
  const overdue = (o.status === 'PENDING' || o.status === 'PAID') && Date.now() - new Date(o.createdAt).getTime() > 24 * 3600 * 1000
  const blocked = blockedReason(o)
  const stockEmpty = o.status === 'PAID' && o.fulfillmentType !== 'on_demand' && o.variantId != null && (o.vaultAvailable ?? 0) === 0
  const blockedTone = blocked?.tone === 'red' ? 'text-red-600' : blocked?.tone === 'amber' ? 'text-amber-700' : 'text-[#aeaeb2]'

  return (
    <SelectableRow
      key={o.id}
      id={o.id}
      selection={selection}
      pageIds={pageIds}
      selectLabel={`Pilih pesanan ${o.id.slice(0, 8).toUpperCase()}`}
    >
      <td>
        <CopyCell value={o.id} display={o.id.slice(0, 8).toUpperCase()} className="ad-num text-xs font-semibold" />
        {o.paymentRef && <div className="ad-num text-[11px] text-[#6e6e73] truncate max-w-28" title={o.paymentRef}>{o.paymentRef}</div>}
      </td>
      <td className="whitespace-nowrap">
        <div className="text-xs ad-num text-[#6e6e73]">{new Date(o.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</div>
        <div className={`text-[11px] ad-num ${overdue ? 'text-red-600 font-semibold' : 'text-[#aeaeb2]'}`}>{formatAge(o.createdAt)}</div>
      </td>
      <td>
        <div className="text-[13px] ad-num font-medium">{o.productName}</div>
        <div className="text-[11px] ad-num text-[#6e6e73]">{o.fulfillmentType === 'on_demand' ? 'On-demand' : 'Vault'}</div>
      </td>
      <td className="ad-num text-xs text-[#6e6e73]" title={o.customerEmail ?? o.userId}>{o.customerEmail ?? o.userId.slice(0, 8)}</td>
      <td className="text-[13px] ad-num font-semibold">Rp {formatIdNumber(o.amount)}
        {o.status === 'REFUNDED' && o.refundAmount != null && <div className="text-[11px] font-normal text-[#dc2626]">Refund Rp {formatIdNumber(o.refundAmount)}</div>}
      </td>
      <td>
        <StatusChip status={o.status}>{o.status}</StatusChip>
        {blocked && (
          <div className={`mt-1 max-w-32 text-[11px] font-semibold leading-tight ${blockedTone}`}>{blocked.text}</div>
        )}
        {(o.claimCount > 0 || overdue || o.noteCount > 0) && (
          <div className="mt-1 flex max-w-28 flex-wrap gap-1">
            {o.claimCount > 0 && (
              <button onClick={() => actions.openCalculator(o)} title="Buka hitung refund" className="rounded-full border border-amber-500 bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-700 hover:bg-amber-100">
                klaim {o.claimCount}x
              </button>
            )}
            {overdue && (
              <span className="rounded-full border border-red-500 bg-red-50 px-1.5 py-px text-[10px] font-bold text-red-700">overdue</span>
            )}
            {o.noteCount > 0 && (
              <button onClick={() => actions.openTimeline(o)} title="Buka riwayat + catatan" className="rounded-full border border-[#d1d1d6] bg-[#f5f5f7] px-1.5 py-px text-[10px] font-bold text-[#6e6e73] hover:text-black">
                catatan {o.noteCount}x
              </button>
            )}
          </div>
        )}
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-1.5">
          {o.status === 'PENDING' && (
            <button disabled={actions.actionLoading === o.id} onClick={() => { if (o.paymentProvider === 'manual' || o.paymentProvider == null) void actions.openReview(o); else void actions.approveDirect(o.id) }} className="ad-btn ad-btn-dark"><EditPencil width={14} height={14} strokeWidth={1.5} />Setujui</button>
          )}
          {o.status === 'PAID' && (
            <button disabled={actions.actionLoading === o.id || stockEmpty} title={stockEmpty ? 'Stok varian kosong' : undefined} onClick={() => actions.askDeliver(o)} className="ad-btn ad-btn-dark"><Send width={14} height={14} strokeWidth={1.5} />Kirim Akses</button>
          )}
          {o.status === 'DELIVERED' && o.variantPublicId && (
            <button onClick={() => navigate(`/admin/products?tab=stok&variant=${o.variantPublicId}&order=${o.id}`)} title="Buka stok varian untuk ganti kredensial" className="ad-btn ad-btn-dark"><Key width={14} height={14} strokeWidth={1.5} />Ganti Akses</button>
          )}
          {(o.status === 'REJECTED' || o.status === 'REFUNDED') && (
            <>
              <button onClick={() => actions.openReceipt(o)} className="ad-btn"><Notes width={14} height={14} strokeWidth={1.5} />Struk</button>
              <button onClick={() => actions.openTimeline(o)} className="ad-btn"><Clock width={14} height={14} strokeWidth={1.5} />Riwayat</button>
            </>
          )}
          {['PENDING', 'PAID', 'DELIVERED'].includes(o.status) && (
            <RowActionsMenu
              actions={[
                ...(o.variantPublicId && o.status !== 'DELIVERED'
                  ? [{ label: 'Lihat stok', icon: <Key width={14} height={14} strokeWidth={1.5} />, onClick: () => navigate(`/admin/products?tab=stok&variant=${o.variantPublicId}&order=${o.id}`) }]
                  : []),
                ...(o.status === 'PENDING'
                  ? [{ label: 'Tolak', icon: <Trash width={14} height={14} strokeWidth={1.5} />, onClick: () => actions.askReject(o), danger: true, disabled: actions.actionLoading === o.id }]
                  : []),
                ...(o.status === 'PAID'
                  ? [
                      { label: 'Hitung Refund', icon: <Calculator width={14} height={14} strokeWidth={1.5} />, onClick: () => actions.openCalculator(o) },
                      { label: 'Refund', icon: <Undo width={14} height={14} strokeWidth={1.5} />, onClick: () => actions.askRefund(o), danger: true, disabled: actions.actionLoading === o.id },
                    ]
                  : []),
                ...(o.status === 'DELIVERED'
                  ? [{ label: 'Hitung Refund', icon: <Calculator width={14} height={14} strokeWidth={1.5} />, onClick: () => actions.openCalculator(o) }]
                  : []),
                ...(o.status !== 'PENDING'
                  ? [{ label: 'Struk', icon: <Notes width={14} height={14} strokeWidth={1.5} />, onClick: () => actions.openReceipt(o) }]
                  : []),
                { label: 'Riwayat', icon: <Clock width={14} height={14} strokeWidth={1.5} />, onClick: () => actions.openTimeline(o) },
              ]}
            />
          )}
          {actions.actionLoading === o.id && <span className="loading loading-spinner loading-xs"></span>}
        </div>
      </td>
    </SelectableRow>
  )
}
