import { supabase, supabaseAdmin } from '../db'

export type AuditAction =
  | 'order:create' | 'order:approve' | 'order:reject' | 'order:deliver' | 'order:refund' | 'order:replace'
  | 'stock:import'
  | 'vault:unlock' | 'vault:update' | 'vault:delete' | 'vault:revoke'
  | 'product:create' | 'product:update' | 'product:delete'
  | 'variant:create' | 'variant:update' | 'variant:delete'
  | 'settings:update'

export type ActorType = 'admin' | 'user' | 'system'

export async function appendAudit(params: {
  action: AuditAction
  resourceType: 'order' | 'stock' | 'product' | 'variant' | 'settings'
  resourcePublicId?: string
  resourceName?: string
  snapshotText: string
  actorId?: string | null
  actorEmail?: string | null
  actorType: ActorType
  diff?: any
  idempotencyKey?: string | null
}) {
  const { error } = await supabaseAdmin
    .from('audit_logs')
    .insert({
      actor_id: params.actorId ?? null,
      actor_email: params.actorEmail ?? null,
      actor_type: params.actorType,
      action: params.action,
      resource_type: params.resourceType,
      resource_public_id: params.resourcePublicId ?? null,
      resource_name: params.resourceName ?? null,
      snapshot_text: params.snapshotText,
      diff: params.diff ? JSON.stringify(params.diff) : null,
      idempotency_key: params.idempotencyKey ?? null,
    })

  if (error) throw new Error(error.message)
}

export async function findAuditByIdempotencyKey(key: string): Promise<any | null> {
  const { data: rows, error } = await supabaseAdmin
    .from('audit_logs')
    .select('diff')
    .eq('idempotency_key', key)
    .limit(1)

  if (error) throw new Error(error.message)
  if (!rows || rows.length === 0) return null

  const row = rows[0]
  if (!row.diff) return null
  return typeof row.diff === 'string' ? JSON.parse(row.diff) : row.diff
}
