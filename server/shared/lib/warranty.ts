import { supabaseAdmin } from '../db'

// Warranty claim log (spec docs/refund-calculator2026-09-21.md). Single
// source for claim counts: manual claims (admin route) AND credential
// rotates (vault replace) both write here. Historical order:replace audits
// were backfilled once (0026), so counts never read audit_logs.

export interface WarrantyActor {
  sub: string
  email?: string | null
}

export interface WarrantyClaim {
  id: string
  note: string | null
  actorEmail: string | null
  claimedAt: string
}

// Best-effort insert: callers already hold the order row. Never throws —
// a claim-log failure must not roll back the rotate/refund it annotates.
export async function insertWarrantyClaim(
  orderId: string,
  actor: WarrantyActor,
  note: string | null
): Promise<void> {
  await supabaseAdmin
    .from('warranty_claims')
    .insert({
      order_id: orderId,
      note,
      actor_id: actor.sub,
      actor_email: actor.email ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('[warranty] claim insert failed', error.message)
    })
}

export async function countWarrantyClaims(orderId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('warranty_claims')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function listWarrantyClaims(orderId: string): Promise<WarrantyClaim[]> {
  const { data, error } = await supabaseAdmin
    .from('warranty_claims')
    .select('id, note, actor_email, claimed_at')
    .eq('order_id', orderId)
    .order('claimed_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: r.id,
    note: r.note ?? null,
    actorEmail: r.actor_email ?? null,
    claimedAt: r.claimed_at,
  }))
}
