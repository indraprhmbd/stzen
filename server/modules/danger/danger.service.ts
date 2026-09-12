import { supabaseAdmin } from '../../shared/db'
import { NotFoundError } from '../../shared/errors/http'
import { DANGER } from './danger.types'

const ORDERS = 'orders'
const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'
const VAULT_ITEMS = 'vault_items'

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export interface StalePreview {
  olderThanDays: number
  cutoff: string
  count: number
  sampleIds: string[]
}

export interface CatalogPreview {
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

export interface PurgePreview {
  kind: 'orders' | 'vault'
  cutoff: string
  count: number
}

export const dangerService = {
  // ─── Tier 1 preview: abandoned PENDING orders ──────────────────────────
  async previewStaleOrders(olderThanDays: number): Promise<StalePreview> {
    const cutoff = cutoffIso(olderThanDays)
    const { data, error, count } = await supabaseAdmin
      .from(ORDERS)
      .select('public_id', { count: 'exact' })
      .eq('status', 'PENDING')
      .is('payment_ref', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(10)

    if (error) throw new Error(error.message)
    return {
      olderThanDays,
      cutoff,
      count: count ?? 0,
      sampleIds: (data ?? []).map((r: any) => r.public_id),
    }
  },

  // ─── Tier 2 preview: product with blast radius ─────────────────────────
  async previewProduct(publicId: string): Promise<CatalogPreview> {
    const { data: base, error } = await supabaseAdmin
      .from(PRODUCTS)
      .select('id, name')
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!base || base.length === 0) throw new NotFoundError('Product not found')
    const internalId = base[0].id as string

    const { data: variants } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('id')
      .eq('product_id', internalId)
    const variantIds = (variants ?? []).map((v: any) => v.id)

    let vaultAvailable = 0
    let vaultSold = 0
    if (variantIds.length > 0) {
      const { count: avail } = await supabaseAdmin
        .from(VAULT_ITEMS)
        .select('*', { count: 'exact', head: true })
        .in('variant_id', variantIds)
        .eq('status', 'AVAILABLE')
      const { count: sold } = await supabaseAdmin
        .from(VAULT_ITEMS)
        .select('*', { count: 'exact', head: true })
        .in('variant_id', variantIds)
        .eq('status', 'SOLD')
      vaultAvailable = avail ?? 0
      vaultSold = sold ?? 0
    }

    const { count: active } = await supabaseAdmin
      .from(ORDERS)
      .select('*', { count: 'exact', head: true })
      .eq('product_id', internalId)
      .in('status', ['PENDING', 'PAID'])
    const { count: terminal } = await supabaseAdmin
      .from(ORDERS)
      .select('*', { count: 'exact', head: true })
      .eq('product_id', internalId)
      .in('status', ['DELIVERED', 'REFUNDED', 'REJECTED'])

    const blocked = (active ?? 0) > 0
    return {
      publicId,
      name: base[0].name,
      variants: variantIds.length,
      vaultAvailable,
      vaultSold,
      ordersActive: active ?? 0,
      ordersTerminal: terminal ?? 0,
      blocked,
      blockReason: blocked ? 'Masih ada pesanan aktif (PENDING/PAID). Selesaikan dulu.' : null,
    }
  },

  // ─── Tier 2 preview: variant with blast radius ─────────────────────────
  async previewVariant(publicId: string): Promise<CatalogPreview> {
    const { data: base, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('id, name, product_id')
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!base || base.length === 0) throw new NotFoundError('Variant not found')
    const internalId = base[0].id as string

    const { count: avail } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*', { count: 'exact', head: true })
      .eq('variant_id', internalId)
      .eq('status', 'AVAILABLE')
    const { count: sold } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*', { count: 'exact', head: true })
      .eq('variant_id', internalId)
      .eq('status', 'SOLD')
    const { count: active } = await supabaseAdmin
      .from(ORDERS)
      .select('*', { count: 'exact', head: true })
      .eq('variant_id', internalId)
      .in('status', ['PENDING', 'PAID'])
    const { count: terminal } = await supabaseAdmin
      .from(ORDERS)
      .select('*', { count: 'exact', head: true })
      .eq('variant_id', internalId)
      .in('status', ['DELIVERED', 'REFUNDED', 'REJECTED'])

    const blocked = (active ?? 0) > 0
    return {
      publicId,
      name: base[0].name,
      variants: 0,
      vaultAvailable: avail ?? 0,
      vaultSold: sold ?? 0,
      ordersActive: active ?? 0,
      ordersTerminal: terminal ?? 0,
      blocked,
      blockReason: blocked ? 'Masih ada pesanan aktif (PENDING/PAID). Selesaikan dulu.' : null,
    }
  },

  // ─── Tier 3 preview: purgeable terminal rows ───────────────────────────
  async previewPurge(kind: 'orders' | 'vault'): Promise<PurgePreview> {
    if (kind === 'orders') {
      const cutoff = cutoffIso(DANGER.purgeRefundedDays)
      const { count, error } = await supabaseAdmin
        .from(ORDERS)
        .select('*', { count: 'exact', head: true })
        .in('status', ['REJECTED', 'REFUNDED'])
        .lt('created_at', cutoff)
      if (error) throw new Error(error.message)
      return { kind, cutoff, count: count ?? 0 }
    }
    const cutoff = cutoffIso(DANGER.purgeVaultDays)
    const { count, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'AVAILABLE')
      .lt('created_at', cutoff)
    if (error) throw new Error(error.message)
    return { kind, cutoff, count: count ?? 0 }
  },
}
