import { supabaseAdmin } from '../db'
import { NotFoundError } from '../errors/http'

// Operator notes per order (spec docs/orders-overhaul2026-09-21.md Phase 3).
// Ticket-style annotations: handover context, buyer promises, follow-ups.
// Same server-only posture as warranty_claims: RLS on, zero policies.

export interface OrderNote {
  id: string
  note: string
  actorEmail: string | null
  createdAt: string
}

export async function insertOrderNote(
  publicId: string,
  note: string,
  actor: { sub: string; email?: string | null }
): Promise<OrderNote> {
  const orderId = await resolveOrderDbId(publicId)
  const { data, error } = await supabaseAdmin
    .from('order_notes')
    .insert({
      order_id: orderId,
      note,
      actor_id: actor.sub,
      actor_email: actor.email ?? null,
    })
    .select('id, note, actor_email, created_at')
    .single()
  if (error) throw new Error(error.message)
  return {
    id: (data as any).id,
    note: (data as any).note,
    actorEmail: (data as any).actor_email ?? null,
    createdAt: (data as any).created_at,
  }
}

export async function listOrderNotes(publicId: string): Promise<OrderNote[]> {
  const orderId = await resolveOrderDbId(publicId)
  const { data, error } = await supabaseAdmin
    .from('order_notes')
    .select('id, note, actor_email, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map((r: any) => ({
    id: r.id,
    note: r.note,
    actorEmail: r.actor_email ?? null,
    createdAt: r.created_at,
  }))
}

// Admin routes carry public_id; order_notes.order_id is the db uuid FK.
// Resolve first — raw public_id in .eq('order_id') throws uuid syntax error.
async function resolveOrderDbId(publicId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('public_id', publicId)
    .limit(1)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new NotFoundError('Order tidak ditemukan')
  return (data[0] as any).id
}

// Batched per-order counts for a list page. One query per table,
// mapped in JS — same pattern as getStockCounts in orders.service.
export async function countByOrders(
  table: 'warranty_claims' | 'order_notes',
  orderIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (orderIds.length === 0) return counts
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('order_id')
    .in('order_id', orderIds)
  if (error) throw new Error(error.message)
  for (const r of data || []) {
    const id = (r as any).order_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}
