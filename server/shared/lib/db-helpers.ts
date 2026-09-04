import { sql, eq, and, inArray } from 'drizzle-orm'
import { db } from '../db'
import { vaultItems, productVariants } from '../db/schema'

// ─── Shared DB Helpers ──────────────────────────────────────────────────────
// Reusable queries used by multiple modules. Avoids duplication.

export async function getStockCount(variantOrProductId: string): Promise<number> {
  // on_demand variants are always available
  const [variant] = await db.select({ fulfillmentType: productVariants.fulfillmentType }).from(productVariants).where(eq(productVariants.id, variantOrProductId))
  if (variant && (variant as any).fulfillmentType === 'on_demand') return 9999
  // try variant stock
  const [{ count: variantCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(vaultItems)
    .where(and(eq(vaultItems.variantId, variantOrProductId), eq(vaultItems.status, 'AVAILABLE')))
  if (variantCount > 0) return variantCount
  // fallback legacy product stock
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(vaultItems)
    .where(and(eq(vaultItems.productId, variantOrProductId), eq(vaultItems.status, 'AVAILABLE')))
  return count
}

// Atomic credential allocation — calls the allocate_credential(variant_id, order_id)
// Postgres function (FOR UPDATE SKIP LOCKED). Never allocate by querying stock
// and picking a row in JS; that races under concurrent checkouts/webhooks.
// Returns the allocated vault_item row, or null if none were AVAILABLE.
export async function allocateCredential(variantId: string, orderId: string): Promise<{ id: string; variantId: string | null; productId: string | null } | null> {
  const result = (await db.execute(
    sql`select * from allocate_credential(${variantId}::uuid, ${orderId}::uuid)`
  )) as unknown as any
  const rows = Array.isArray(result) ? result : result?.rows ?? []
  const row = rows[0]
  if (!row) return null
  return { id: row.id, variantId: row.variant_id ?? null, productId: row.product_id ?? null }
}

// Batched stock for listings: 2 queries total regardless of row count.
// on_demand variants map to 9999, vault variants to AVAILABLE counts.
export async function getStockCounts(variantIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (variantIds.length === 0) return result
  const types = await db
    .select({ id: productVariants.id, fulfillmentType: productVariants.fulfillmentType })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds))
  const onDemand = new Set(types.filter((t) => t.fulfillmentType === 'on_demand').map((t) => t.id))
  const vaultIds = variantIds.filter((id) => !onDemand.has(id))
  const counts = vaultIds.length > 0
    ? await db
      .select({ variantId: vaultItems.variantId, count: sql<number>`cast(count(*) as int)` })
      .from(vaultItems)
      .where(and(inArray(vaultItems.variantId, vaultIds), eq(vaultItems.status, 'AVAILABLE')))
      .groupBy(vaultItems.variantId)
    : []
  const byId = new Map(counts.map((c) => [c.variantId as string, c.count]))
  for (const id of variantIds) {
    result.set(id, onDemand.has(id) ? 9999 : byId.get(id) ?? 0)
  }
  return result
}
