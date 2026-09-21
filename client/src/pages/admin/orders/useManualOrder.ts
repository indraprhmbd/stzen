import { useState } from 'react'
import { authedApiRequest } from '../../../lib/api'
import type { AdminOrder, ManualVariant } from './types'

export interface ManualOrderApi {
  mEmail: string
  setMEmail: (v: string) => void
  mAccount: string
  setMAccount: (v: string) => void
  mWa: string
  setMWa: (v: string) => void
  mVariantId: string
  setMVariantId: (v: string) => void
  mSearch: string
  setMSearch: (v: string) => void
  mPaymentRef: string
  setMPaymentRef: (v: string) => void
  mUseCustom: boolean
  setMUseCustom: (v: boolean) => void
  mCustomPrice: string
  setMCustomPrice: (v: string) => void
  mStep: 1 | 2
  mCreated: { id: string; productName: string; amount: string; status: string; createdAt: string } | null
  mError: string | null
  mSaving: boolean
  mReview: AdminOrder | null
  mSelected: ManualVariant | null
  mCatalogPrice: string
  mFinalPrice: string
  mFiltered: ManualVariant[]
  resetManualForm: () => void
  openManual: () => Promise<void>
  openReview: (o: AdminOrder) => Promise<void>
  submitManual: (e: React.FormEvent) => Promise<void>
  submitReview: (e: React.FormEvent) => Promise<void>
}

export function useManualOrder(opts: {
  onMutated: () => void | Promise<void>
  setActionMsg: (msg: string | null) => void
}): ManualOrderApi {
  const { onMutated, setActionMsg } = opts
  const [manualVariants, setManualVariants] = useState<ManualVariant[]>([])
  const [mEmail, setMEmail] = useState('')
  const [mAccount, setMAccount] = useState('')
  const [mWa, setMWa] = useState('')
  // Review mode: Setujui on a manual PENDING row prefills this form instead
  // of bare-approving. Null = create mode.
  const [mReview, setMReview] = useState<AdminOrder | null>(null)
  const [mVariantId, setMVariantId] = useState('')
  const [mSearch, setMSearch] = useState('')
  const [mPaymentRef, setMPaymentRef] = useState('')
  const [mUseCustom, setMUseCustom] = useState(false)
  const [mCustomPrice, setMCustomPrice] = useState('')
  const [mStep, setMStep] = useState<1 | 2>(1)
  const [mCreated, setMCreated] = useState<{ id: string; productName: string; amount: string; status: string; createdAt: string } | null>(null)
  const [mError, setMError] = useState<string | null>(null)
  const [mSaving, setMSaving] = useState(false)

  // Manual-order derived state: selected variant, catalog vs final price,
  // and the search-filtered picker list.
  const mSelected = manualVariants.find((v) => v.id === mVariantId) ?? null
  const mCatalogPrice = mSelected ? String(mSelected.price) : ''
  const mFinalPrice = mUseCustom && mCustomPrice ? mCustomPrice : mCatalogPrice
  const mFiltered = manualVariants.filter((v) =>
    !mSearch || v.name.toLowerCase().includes(mSearch.toLowerCase())
  )

  function resetManualForm() {
    setMEmail('')
    setMVariantId('')
    setMSearch('')
    setMPaymentRef('')
    setMUseCustom(false)
    setMCustomPrice('')
    setMAccount('')
    setMWa('')
    setMReview(null)
    setMError(null)
    setMCreated(null)
    setMStep(1)
  }

  async function ensureManualVariants(): Promise<ManualVariant[]> {
    if (manualVariants.length > 0) return manualVariants
    try {
      const res = await authedApiRequest((c) => c.api.v1.admin.variants.$get({ query: { compact: '1' } }))
      const list = (await res.json()) as { id: string; name: string; price: string | number; isActive: boolean; requiresDeliveryInfo?: boolean }[]
      const mapped = list.filter((v) => v.isActive).map((v) => ({ id: v.id, name: v.name, price: v.price, requiresDeliveryInfo: v.requiresDeliveryInfo ?? false }))
      setManualVariants(mapped)
      return mapped
    } catch {
      setMError('Gagal memuat varian')
      return []
    }
  }

  async function openManual() {
    resetManualForm()
    setMError(null)
    await ensureManualVariants()
    ;(document.getElementById('manual_modal') as HTMLDialogElement | null)?.showModal()
  }

  // Review mode: manual PENDING rows land here prefilled — price + contact
  // editable, email/variant locked — instead of a bare Setujui click.
  async function openReview(o: AdminOrder) {
    resetManualForm()
    setMError(null)
    const list = await ensureManualVariants()
    const match = list.find((v) => v.id === o.variantPublicId) ?? null
    setMEmail(o.customerEmail ?? '')
    if (match) {
      setMVariantId(match.id)
      if (o.amount !== String(match.price)) {
        setMUseCustom(true)
        setMCustomPrice(o.amount)
      }
    }
    setMPaymentRef(o.paymentRef ?? '')
    setMAccount(o.customerAccount ?? '')
    setMWa(o.waNumber ?? '')
    setMReview(o)
    ;(document.getElementById('manual_modal') as HTMLDialogElement | null)?.showModal()
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    setMError(null)
    setMSaving(true)
    try {
      // Custom amount only crosses the wire when the operator explicitly set
      // a different price; otherwise the server uses the catalog price.
      const customAmount = mUseCustom && mCustomPrice && mCustomPrice !== mCatalogPrice ? mCustomPrice : undefined
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.orders.manual.$post({
          json: {
            customerEmail: mEmail.trim(),
            variantId: mVariantId,
            paymentRef: mPaymentRef.trim() || null,
            ...(customAmount ? { amount: customAmount } : {}),
            ...(mAccount.trim() ? { customerAccount: mAccount.trim() } : {}),
            ...(mWa.trim() ? { waNumber: mWa.trim() } : {}),
          },
        })
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal membuat pesanan')
      }
      const created = (await res.json()) as { id: string; productName: string; amount: string; status: string; createdAt: string }
      setMCreated(created)
      setMStep(2)
      await onMutated()
    } catch (err: unknown) {
      setMError(err instanceof Error ? err.message : 'Gagal membuat pesanan')
    } finally {
      setMSaving(false)
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!mReview) return
    setMError(null)
    setMSaving(true)
    try {
      const customAmount = mUseCustom && mCustomPrice && mCustomPrice !== mCatalogPrice ? mCustomPrice : undefined
      const res = await authedApiRequest((c) =>
        c.api.v1.admin.orders[':id']['approve-manual'].$post(
          {
            param: { id: mReview.id },
            json: {
              ...(customAmount ? { amount: customAmount } : {}),
              customerAccount: mAccount.trim(),
              waNumber: mWa.trim(),
            },
          },
          { headers: { 'Idempotency-Key': crypto.randomUUID() } }
        )
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Gagal menyetujui')
      }
      const out = (await res.json()) as { order: AdminOrder; allocated: boolean }
      setMReview(null)
      ;(document.getElementById('manual_modal') as HTMLDialogElement | null)?.close()
      await onMutated()
      setActionMsg(out.allocated ? `Disetujui + dialokasikan: ${out.order.productName}` : 'Disetujui (PAID), lanjut Kirim Akses dari antrean')
    } catch (err: unknown) {
      setMError(err instanceof Error ? err.message : 'Gagal menyetujui')
    } finally {
      setMSaving(false)
    }
  }

  return {
    mEmail, setMEmail, mAccount, setMAccount, mWa, setMWa,
    mVariantId, setMVariantId, mSearch, setMSearch, mPaymentRef, setMPaymentRef,
    mUseCustom, setMUseCustom, mCustomPrice, setMCustomPrice,
    mStep, mCreated, mError, mSaving, mReview,
    mSelected, mCatalogPrice, mFinalPrice, mFiltered,
    resetManualForm, openManual, openReview, submitManual, submitReview,
  }
}
