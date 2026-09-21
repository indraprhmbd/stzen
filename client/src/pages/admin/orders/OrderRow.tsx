import { useNavigate } from 'react-router-dom'
import CopyCell from '../../../components/admin/CopyCell'
import StatusChip from '../../../components/admin/StatusChip'
import RowActionsMenu from '../../../components/admin/RowActionsMenu'
import { SelectableRow } from '../../../components/admin/RowSelection'
import { Key, EditPencil, Trash, Notes, Calculator, Send, Undo, Clock } from 'iconoir-react'
import { formatIdNumber } from '../../../lib/format'
import type { AdminOrder } from './types'
import { formatAge } from './types'

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
  const stockout = o.fulfillmentType !== 'on_demand' && o.vaultAvailable === 0
  const overdue = (o.status === 'PENDING' || o.status === 'PAID') && Date.now() - new Date(o.createdAt).getTime() > 24 * 3600 * 1000

  return (
    <SelectableRow
      key={o.id}
      id={o.id}
      selection={selection}
      pageIds={pageIds}
      selectLabel={`Pilih pesanan ${o.id.slice(0, 8).toUpperCase()}`}
    >
      <td><CopyCell value={o.id} display={o.id.slice(0, 8).toUpperCase()} className="ad-num text-xs font-semibold" /></td>
      <td className="text-xs ad-num text-[#6e6e73] whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
      <td className={`text-xs ad-num whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-[#6e6e73]'}`}>{formatAge(o.createdAt)}</td>
      <td className="text-[13px] ad-num font-medium">{o.productName}</td>
      <td className="whitespace-nowrap text-xs ad-num">
        {[o.fulfillmentType === 'on_demand' ? 'On-demand' : 'Vault', stockout ? 'Stok habis' : null].filter(Boolean).join(', ')}
      </td>
      <td className="ad-num text-xs text-[#6e6e73]" title={o.customerEmail ?? o.userId}>{o.customerEmail ?? o.userId.slice(0, 8)}</td>
      <td className="text-[13px] ad-num font-semibold">Rp {formatIdNumber(o.amount)}
        {o.status === 'REFUNDED' && o.refundAmount != null && <div className="text-[11px] font-normal text-[#dc2626]">Refund Rp {formatIdNumber(o.refundAmount)}</div>}
      </td>
      <td><StatusChip status={o.status}>{o.status}</StatusChip></td>
      <td className="text-right">
        <div className="flex justify-end gap-1.5">
          {o.status === 'PENDING' && (
            <button disabled={actions.actionLoading === o.id} onClick={() => { if (o.paymentProvider === 'manual' || o.paymentProvider == null) void actions.openReview(o); else void actions.approveDirect(o.id) }} className="ad-btn ad-btn-dark"><EditPencil width={14} height={14} strokeWidth={1.5} />Setujui</button>
          )}
          {o.status === 'PAID' && (
            <button disabled={actions.actionLoading === o.id} onClick={() => actions.askDeliver(o)} className="ad-btn ad-btn-dark"><Send width={14} height={14} strokeWidth={1.5} />Kirim Akses</button>
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
