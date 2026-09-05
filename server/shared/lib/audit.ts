import { db } from '../db'
import { sql } from 'drizzle-orm'

export type AuditAction =
  | 'order:create' | 'order:approve' | 'order:reject' | 'order:deliver' | 'order:refund' | 'order:replace'
  | 'stock:import'
  | 'vault:unlock' | 'vault:update' | 'vault:delete' | 'vault:revoke'
  | 'product:create' | 'product:update' | 'product:delete'
  | 'variant:create' | 'variant:update' | 'variant:delete'
  | 'settings:update'

export async function appendAudit(params: {
  action: AuditAction
  resourceType: 'order' | 'stock' | 'product' | 'variant' | 'settings'
  resourcePublicId?: string
  resourceName?: string
  snapshotText: string
  actorId?: string | null
  actorEmail?: string | null
  diff?: any
  idempotencyKey?: string | null
}) {
  await db.execute(sql`
    insert into audit_logs (actor_id, actor_email, action, resource_type, resource_public_id, resource_name, snapshot_text, diff, idempotency_key)
    values (${params.actorId ?? null}::uuid, ${params.actorEmail ?? null}, ${params.action}, ${params.resourceType}, ${params.resourcePublicId ?? null}, ${params.resourceName ?? null}, ${params.snapshotText}, ${params.diff ? JSON.stringify(params.diff) : null}::jsonb, ${params.idempotencyKey ?? null})
  `)
}

// Returns the stored result of a previous request with the same key, or null.
export async function findAuditByIdempotencyKey(key: string): Promise<any | null> {
  const rows = (await db.execute(sql`
    select diff from audit_logs where idempotency_key = ${key} limit 1
  `)) as unknown as any
  const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0]
  if (!row?.diff) return null
  return typeof row.diff === 'string' ? JSON.parse(row.diff) : row.diff
}
