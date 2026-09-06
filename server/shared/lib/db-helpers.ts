import { supabaseAdmin } from '../db'
import { vaultItems, productVariants } from '../db/schema'

export async function getStockCount(variantOrProductId: string): Promise<number> {
  const { data: variant } = await supabaseAdmin
    .from('product_variants')
    .select('fulfillment_type')
    .eq('id', variantOrProductId)
    .limit(1)

  if (variant && variant.length > 0 && variant[0].fulfillment_type === 'on_demand') {
    return 9999
  }

  const { count: variantCount } = await supabaseAdmin
    .from('vault_items')
    .select('*', { count: 'exact', head: true })
    .eq('variant_id', variantOrProductId)
    .eq('status', 'AVAILABLE')

  if ((variantCount || 0) > 0) return variantCount || 0

  const { count } = await supabaseAdmin
    .from('vault_items')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', variantOrProductId)
    .eq('status', 'AVAILABLE')

  return count || 0
}

export async function allocateCredential(variantId: string, orderId: string): Promise<{ id: string; variantId: string | null; productId: string | null } | null> {
  const { data, error } = await supabaseAdmin.rpc('allocate_credential', {
    p_variant_id: variantId,
    p_order_id: orderId,
  })

  if (error) {
    console.error('[allocateCredential] rpc error', { variantId, orderId, error })
    return null
  }

  console.error('[allocateCredential] rpc raw result', { variantId, orderId, data, dataType: typeof data, isArray: Array.isArray(data) })

  const rows = Array.isArray(data) ? data : data ? [data] : []
  if (rows.length === 0) {
    console.error('[allocateCredential] empty result after normalization', { variantId, orderId, rows })
    return null
  }

  const row = rows[0]
  return { id: row.id, variantId: row.variant_id ?? null, productId: row.product_id ?? null }
}

export async function getStockCounts(variantIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (variantIds.length === 0) return result

  const { data: types } = await supabaseAdmin
    .from('product_variants')
    .select('id, fulfillment_type')
    .in('id', variantIds)

  const onDemand = new Set((types || []).filter((t: any) => t.fulfillment_type === 'on_demand').map((t: any) => t.id))
  const vaultIds = variantIds.filter((id) => !onDemand.has(id))

  for (const id of vaultIds) {
    result.set(id, 0)
  }

  if (vaultIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('vault_items')
      .select('variant_id')
      .in('variant_id', vaultIds)
      .eq('status', 'AVAILABLE')

    const counts = new Map<string, number>()
    for (const item of items || []) {
      counts.set(item.variant_id, (counts.get(item.variant_id) || 0) + 1)
    }

    for (const id of vaultIds) {
      result.set(id, counts.get(id) || 0)
    }
  }

  for (const id of variantIds) {
    if (onDemand.has(id)) {
      result.set(id, 9999)
    }
  }

  return result
}
