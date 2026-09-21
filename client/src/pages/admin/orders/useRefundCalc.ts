import { useState } from 'react'
import { authedApiRequest } from '../../../lib/api'
import type { AdminOrder, RefundCalcData } from './types'

export interface RefundCalcApi {
  calcOrder: AdminOrder | null
  calcData: RefundCalcData | null
  calcLoading: boolean
  calcErr: string | null
  claimNote: string
  setClaimNote: (v: string) => void
  claimSaving: boolean
  loadCalcPreview: (orderId: string) => Promise<void>
  openCalculator: (o: AdminOrder) => void
  submitClaim: () => Promise<void>
  applyCalcRefund: () => void
}

export function useRefundCalc(opts: {
  askRefund: (o: AdminOrder) => void
}): RefundCalcApi {
  const { askRefund } = opts
  const [calcOrder, setCalcOrder] = useState<AdminOrder | null>(null)
  const [calcData, setCalcData] = useState<RefundCalcData | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcErr, setCalcErr] = useState<string | null>(null)
  const [claimNote, setClaimNote] = useState('')
  const [claimSaving, setClaimSaving] = useState(false)

  // Refund kalkulator: preview math is server-side; the dialog only
  // displays. Lanjut ke Refund reuses the existing refund confirm flow.
  async function loadCalcPreview(orderId: string) {
    setCalcLoading(true)
    setCalcErr(null)
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.orders[':id']['refund-preview'].$get({ param: { id: orderId } }))
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal menghitung refund')
      }
      setCalcData((await res.json()) as RefundCalcData)
    } catch (e: unknown) {
      setCalcErr(e instanceof Error ? e.message : 'Gagal menghitung refund')
      setCalcData(null)
    } finally { setCalcLoading(false) }
  }

  function openCalculator(o: AdminOrder) {
    setCalcOrder(o)
    setCalcData(null)
    setClaimNote('')
    setCalcErr(null)
    ;(document.getElementById('refund_calc_modal') as HTMLDialogElement | null)?.showModal()
    void loadCalcPreview(o.id)
  }

  async function submitClaim() {
    if (!calcOrder || claimSaving) return
    setClaimSaving(true)
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.warranty.$post({ json: { orderId: calcOrder.id, note: claimNote.trim() || undefined } }))
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal mencatat klaim')
      }
      setClaimNote('')
      await loadCalcPreview(calcOrder.id)
    } catch (e: unknown) {
      setCalcErr(e instanceof Error ? e.message : 'Gagal mencatat klaim')
    } finally { setClaimSaving(false) }
  }

  function applyCalcRefund() {
    if (!calcOrder) return
    const o = calcOrder
    ;(document.getElementById('refund_calc_modal') as HTMLDialogElement | null)?.close()
    setCalcOrder(null)
    askRefund(o)
  }

  return {
    calcOrder, calcData, calcLoading, calcErr,
    claimNote, setClaimNote, claimSaving,
    loadCalcPreview, openCalculator, submitClaim, applyCalcRefund,
  }
}
