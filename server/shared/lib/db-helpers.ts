import { sql, eq, and } from 'drizzle-orm'
import { db } from '../db'
import { vaultItems } from '../db/schema'

// ─── Shared DB Helpers ──────────────────────────────────────────────────────
// Reusable queries used by multiple modules. Avoids duplication.

export async function getStockCount(productId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(vaultItems)
    .where(
      and(
        eq(vaultItems.productId, productId),
        eq(vaultItems.status, 'AVAILABLE')
      )
    )
  return count
}
