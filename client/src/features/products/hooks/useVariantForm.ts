import { useState } from 'react'
import { authedApiRequest } from '../../../lib/api'
import type { Product, Variant } from '../types'

// Moved as-is from pages/admin/Products.tsx: variant form state + CRUD +
// induk auto-fill (fills empties only, save stays link-preserving).
export function useVariantForm(products: Product[], fetchAll: () => void, showToast: (msg: string, type: 'success' | 'error') => void) {
  const [vProductId, setVProductId] = useState('')
  const [vPrice, setVPrice] = useState('')
  const [vCompareAt, setVCompareAt] = useState('')
  const [vDuration, setVDuration] = useState<string>('')
  const [vDurationUnit, setVDurationUnit] = useState<'day' | 'week' | 'month'>('month')
  const [vAccountType, setVAccountType] = useState('')
  const [vConditions, setVConditions] = useState('')
  const [vBadge, setVBadge] = useState('')
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [editingVariantSku, setEditingVariantSku] = useState<string | null>(null)
  const [vFulfillmentType, setVFulfillmentType] = useState<'vault' | 'on_demand'>('vault')
  const [vIsActive, setVIsActive] = useState(true)
  const [vOverview, setVOverview] = useState('')
  const [vDescription, setVDescription] = useState('')
  // Explicit blank: user pressed Kosongkan. '' persists and hides the field
  // in the catalog. Without it, empty input means inherit (null).
  const [vOverviewBlank, setVOverviewBlank] = useState(false)
  const [vDescriptionBlank, setVDescriptionBlank] = useState(false)

  function openCreateVariant(presetProductId?: string) {
    const baseId = presetProductId ?? products[0]?.id ?? ''
    const base = products.find((p) => p.id === baseId)
    setEditingVariantId(null); setEditingVariantSku(null); setVProductId(baseId); setVPrice(''); setVCompareAt(''); setVDuration(''); setVDurationUnit('month'); setVAccountType(''); setVConditions(''); setVBadge(''); setVFulfillmentType('vault'); setVIsActive(true)
    setVOverview(base?.overview ?? ''); setVDescription(base?.description ?? '')
    setVOverviewBlank(false); setVDescriptionBlank(false)
    ;(document.getElementById('variant_modal') as HTMLDialogElement)?.showModal()
  }
  function openEditVariant(v: Variant) {
    setEditingVariantId(v.id); setEditingVariantSku(v.sku); setVProductId(v.productId ?? ''); setVPrice(String(v.price)); setVCompareAt(v.compareAtPrice ? String(v.compareAtPrice) : ''); setVDuration(v.durationMonths ? String(v.durationMonths) : ''); setVDurationUnit((v.durationUnit as 'day' | 'week' | 'month') ?? 'month'); setVAccountType(v.accountType ?? ''); setVConditions(v.conditions ?? ''); setVBadge(v.badge ?? ''); setVFulfillmentType(v.fulfillmentType === 'on_demand' ? 'on_demand' : 'vault'); setVIsActive(v.isActive)
    const base = products.find((p) => p.id === (v.productId ?? ''))
    setVOverview(v.overview ?? base?.overview ?? ''); setVDescription(v.description ?? base?.description ?? '')
    setVOverviewBlank(v.overview === ''); setVDescriptionBlank(v.description === '')
    ;(document.getElementById('variant_modal') as HTMLDialogElement)?.showModal()
  }
  // Switching induk refills content fields only when the user hasn't typed
  // their own and hasn't explicitly blanked them.
  function handleVariantBaseChange(newId: string) {
    setVProductId(newId)
    const base = products.find((p) => p.id === newId)
    if (!vOverviewBlank) setVOverview((prev) => (prev.trim() === '' ? (base?.overview ?? '') : prev))
    if (!vDescriptionBlank) setVDescription((prev) => (prev.trim() === '' ? (base?.description ?? '') : prev))
  }

  async function handleVariantSubmit(e: React.FormEvent, onCreateSuccess?: (id: string) => void) {
    e.preventDefault()
    // Link-preserving save: text identical to the induk stays null (live
    // fallback, no stale copies); explicit blank stays '' (hidden in
    // catalog); only real edits become variant overrides.
    const base = products.find((p) => p.id === vProductId)
    const trimmedOverview = vOverview.trim()
    const trimmedDescription = vDescription.trim()
    const payload: any = {
      productId: vProductId,
      price: vPrice,
      compareAtPrice: vCompareAt.trim() === '' ? null : vCompareAt.trim(),
      badge: vBadge || null,
      durationMonths: vDuration ? parseInt(vDuration, 10) : null,
      durationUnit: vDurationUnit,
      accountType: vAccountType || null,
      conditions: vConditions || null,
      fulfillmentType: vFulfillmentType,
      isActive: vIsActive,
      overview: vOverviewBlank ? '' : trimmedOverview === '' || trimmedOverview === (base?.overview ?? '').trim() ? null : trimmedOverview,
      description: vDescriptionBlank ? '' : trimmedDescription === '' || trimmedDescription === (base?.description ?? '').trim() ? null : vDescription,
    }
    try {
      if (editingVariantId) {
        await authedApiRequest((c) => c.api.v1.admin.variants[':id'].$put({ param: { id: editingVariantId }, json: payload }))
        showToast('Varian diperbarui', 'success')
        ;(document.getElementById('variant_modal') as HTMLDialogElement)?.close()
      } else {
        const res = await authedApiRequest((c) => c.api.v1.admin.variants.$post({ json: payload }))
        const created = await res.json() as { id: string }
        showToast('Varian dibuat', 'success')
        if (onCreateSuccess) {
          onCreateSuccess(created.id)
        } else {
          ;(document.getElementById('variant_modal') as HTMLDialogElement)?.close()
        }
      }
      fetchAll()
    } catch { showToast('Gagal menyimpan varian', 'error') }
  }

  return {
    vProductId, vPrice, vCompareAt, vDuration, vDurationUnit, vAccountType, vConditions, vBadge,
    editingVariantId, editingVariantSku, vFulfillmentType, vIsActive, vOverview, vDescription,
    vOverviewBlank, vDescriptionBlank,
    setVProductId, setVPrice, setVCompareAt, setVDuration, setVDurationUnit, setVAccountType, setVConditions, setVBadge,
    setVFulfillmentType, setVIsActive, setVOverview, setVDescription,
    setVOverviewBlank, setVDescriptionBlank,
    openCreateVariant, openEditVariant, handleVariantBaseChange, handleVariantSubmit,
  }
}
