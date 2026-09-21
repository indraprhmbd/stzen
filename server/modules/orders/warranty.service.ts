import { supabaseAdmin } from '../../shared/db'
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/http'
import { appendAudit } from '../../shared/lib/audit'
import { countWarrantyClaims, listWarrantyClaims, type WarrantyActor, type WarrantyClaim } from '../../shared/lib/warranty'
import { computeRefund, type RefundPreview } from '../../shared/lib/refundCalc'

const ORDERS = 'orders'
const WARRANTY_CLAIMS = 'warranty_claims'

export interface WarrantyDeps {
  fetchOrder?: (publicId: string) => Promise<any | null>
  insertClaim?: (orderId: string, note: string | null, actor: WarrantyActor) => Promise<void>
  countClaims?: (orderId: string) => Promise<number>
  listClaims?: (orderId: string) => Promise<WarrantyClaim[]>
}

async function defaultFetchOrder(publicId: string): Promise<any | null> {
  const { data, error } = await supabaseAdmin
    .from(ORDERS)
    .select('id, amount, status, paid_at, duration_snapshot, duration_snapshot_unit')
    .eq('public_id', publicId)
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] ?? null
}

async function defaultInsertClaim(orderId: string, note: string | null, actor: WarrantyActor): Promise<void> {
  const { error } = await supabaseAdmin
    .from(WARRANTY_CLAIMS)
    .insert({ order_id: orderId, note, actor_id: actor.sub, actor_email: actor.email ?? null })
  if (error) throw new Error(error.message)
}

async function resolveOrder(publicId: string, deps: WarrantyDeps): Promise<any> {
  const fetch = deps.fetchOrder ?? defaultFetchOrder
  const order = await fetch(publicId)
  if (!order) throw new NotFoundError('Order tidak ditemukan')
  return order
}

export const warrantyService = {
  // Manual claim (admin route). DELIVERED-only: nothing to warrant before
  // the credential exists — mirrors the vault rotate guard.
  async recordClaim(publicId: string, note: string | null, actor: WarrantyActor, deps: WarrantyDeps = {}): Promise<{ claimCount: number }> {
    const order = await resolveOrder(publicId, deps)
    if (order.status !== 'DELIVERED') throw new ConflictError('Klaim garansi hanya untuk pesanan DELIVERED')
    const insert = deps.insertClaim ?? defaultInsertClaim
    await insert(order.id, note, actor)
    await appendAudit({
      action: 'warranty:claim',
      resourceType: 'order',
      resourcePublicId: publicId,
      snapshotText: `Klaim garansi dicatat oleh ${actor.email ?? actor.sub}${note ? `: ${note}` : ''}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})
    const count = deps.countClaims ?? countWarrantyClaims
    return { claimCount: await count(order.id) }
  },

  async getClaims(publicId: string, deps: WarrantyDeps = {}): Promise<{ claimCount: number; claims: WarrantyClaim[] }> {
    const order = await resolveOrder(publicId, deps)
    const count = deps.countClaims ?? countWarrantyClaims
    const list = deps.listClaims ?? listWarrantyClaims
    const [claimCount, claims] = await Promise.all([count(order.id), list(order.id)])
    return { claimCount, claims }
  },

  // Full preview for the kalkulator dialog. Returns null preview (not a
  // throw) when the order lacks duration data — the dialog explains why.
  async getRefundPreview(
    publicId: string,
    nowMs: number = Date.now(),
    deps: WarrantyDeps = {}
  ): Promise<{
    amount: number
    status: string
    paidAt: string | null
    claimCount: number
    claims: WarrantyClaim[]
    preview: RefundPreview | null
  }> {
    const order = await resolveOrder(publicId, deps)
    const count = deps.countClaims ?? countWarrantyClaims
    const list = deps.listClaims ?? listWarrantyClaims
    const [claimCount, claims] = await Promise.all([count(order.id), list(order.id)])
    const amount = Number(order.amount) || 0
    const preview = order.paid_at
      ? computeRefund({
          amount,
          totalValue: order.duration_snapshot,
          totalUnit: order.duration_snapshot_unit,
          paidAt: order.paid_at,
          now: nowMs,
          claimCount,
        })
      : null
    if (order.paid_at == null) throw new BadRequestError('Pesanan belum dibayar')
    return { amount, status: order.status, paidAt: order.paid_at, claimCount, claims, preview }
  },
}
