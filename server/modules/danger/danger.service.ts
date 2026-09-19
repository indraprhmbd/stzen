import { supabaseAdmin } from '../../shared/db'
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/http'
import { appendAudit, claimIdempotencyKey } from '../../shared/lib/audit'
import { hmacSha256Hex, verifyHmacSha256Hex } from '../../shared/lib/hmac'
import { getEnv } from '../../shared/lib/runtime-env'
import { ordersService } from '../orders/orders.service'
import { DANGER, type ExportFilter } from './danger.types'

const ORDERS = 'orders'
const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'
const VAULT_ITEMS = 'vault_items'

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

// Hard delete is allowed only for catalog rows with no history: zero orders
// of any status and zero vault rows. Anything else must be deactivated
// (is_active=false) so buyer credentials and records stay intact.
function blockReason(active: number, terminal: number, _vault: number): string {
  if (active > 0) return 'Masih ada pesanan aktif (PENDING/PAID). Selesaikan dulu.'
  if (terminal > 0) return 'Sudah ada riwayat pesanan. Nonaktifkan saja agar kredensial pembeli tetap bisa dibuka.'
  return 'Masih ada stok atau kredensial terjual. Nonaktifkan saja.'
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
    const internalId = base[0]!.id as string

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

    const blocked = (active ?? 0) > 0 || (terminal ?? 0) > 0 || vaultAvailable + vaultSold > 0
    return {
      publicId,
      name: base[0]!.name,
      variants: variantIds.length,
      vaultAvailable,
      vaultSold,
      ordersActive: active ?? 0,
      ordersTerminal: terminal ?? 0,
      blocked,
      blockReason: blocked ? blockReason(active ?? 0, terminal ?? 0, vaultAvailable + vaultSold) : null,
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
    const internalId = base[0]!.id as string

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

    const blocked = (active ?? 0) > 0 || (terminal ?? 0) > 0 || (avail ?? 0) + (sold ?? 0) > 0
    return {
      publicId,
      name: base[0]!.name,
      variants: 0,
      vaultAvailable: avail ?? 0,
      vaultSold: sold ?? 0,
      ordersActive: active ?? 0,
      ordersTerminal: terminal ?? 0,
      blocked,
      blockReason: blocked ? blockReason(active ?? 0, terminal ?? 0, (avail ?? 0) + (sold ?? 0)) : null,
    }
  },

  // ─── Tier 3 preview: purgeable stale AVAILABLE vault ───────────────────
  // Orders are never purgeable: PAID/DELIVERED/REFUNDED are bookkeeping
  // evidence (UU KUP 10-year retention), REJECTED stays for disputes.
  async previewPurge(): Promise<PurgePreview> {
    const cutoff = cutoffIso(DANGER.purgeVaultDays)
    const { count, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'AVAILABLE')
      .lt('created_at', cutoff)
    if (error) throw new Error(error.message)
    return { kind: 'vault', cutoff, count: count ?? 0 }
  },
}

export interface Actor {
  sub: string
  email?: string
}

function actorTag(a: Actor): string {
  return a.email ?? a.sub
}

function nowId(): string {
  return new Date().toLocaleString('id-ID')
}

// One call processes at most this many rows so a giant backlog cannot pin
// the pooler. Operator repeats with the same phrase until preview hits zero.
const EXEC_BATCH_LIMIT = 200

// ─── Export token: stateless, single-use ────────────────────────────────────
// Token embeds the exact filter it authorizes: b64(filter).exp.sig, HMAC over
// the first two segments with the server secret. Single-use is enforced by
// burning the signature in idempotency_claims on purge (23505 = replay).
// No migration needed: no new table, no server-side session.

function exportSecret(): string {
  const s = getEnv('AES_SECRET_KEY')
  if (!s) throw new Error('AES_SECRET_KEY not configured')
  return s
}

function b64encode(obj: unknown): string {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64decode<T>(raw: string): T | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(columns: string[], rows: Record<string, any>[]): string {
  const head = columns.map(csvCell).join(',')
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))
  return [head, ...body].join('\n')
}

// Vault export deliberately excludes credential_payload: ciphertext has no
// audit value on an operator's disk and must not leave the vault table.
const VAULT_EXPORT_COLUMNS = [
  'id', 'status', 'product_id', 'variant_id', 'created_at', 'allocated_at',
]

async function deleteInBatches(table: string, ids: string[]): Promise<number> {
  let deleted = 0
  for (let i = 0; i < ids.length; i += DANGER.purgeBatchSize) {
    const chunk = ids.slice(i, i + DANGER.purgeBatchSize)
    const { data, error } = await supabaseAdmin.from(table).delete().in('id', chunk).select('id')
    if (error) throw new Error(error.message)
    deleted += data?.length ?? 0
  }
  return deleted
}

export const dangerExecute = {
  // ─── Tier 1 execute: bulk-reject abandoned PENDING ─────────────────────
  async rejectStaleOrders(olderThanDays: number, actor: Actor) {
    const cutoff = cutoffIso(olderThanDays)
    const { data, error } = await supabaseAdmin
      .from(ORDERS)
      .select('public_id')
      .eq('status', 'PENDING')
      .is('payment_ref', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(EXEC_BATCH_LIMIT + 1)

    if (error) throw new Error(error.message)
    const targets = (data ?? []).map((r: any) => r.public_id as string)
    const hasMore = targets.length > EXEC_BATCH_LIMIT
    const batch = targets.slice(0, EXEC_BATCH_LIMIT)

    const rejected: string[] = []
    const skipped: string[] = []
    for (const id of batch) {
      try {
        // Conditional inside transitionStatus via getById + valid transition;
        // a webhook claimPaid racing us lands in skipped, never half-applied.
        await ordersService.transitionStatus(id, 'reject')
        rejected.push(id)
      } catch {
        skipped.push(id)
      }
    }

    await appendAudit({
      action: 'danger:stale-reject',
      resourceType: 'danger',
      snapshotText: `Danger Zone: ${rejected.length} pesanan basi ditolak oleh ${actorTag(actor)} ${nowId()}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
      diff: { olderThanDays, rejected, skipped, hasMore },
    }).catch((e) => console.error('[audit] danger stale-reject failed', e))

    return { rejected: rejected.length, skipped: skipped.length, hasMore, ids: rejected }
  },

  // ─── Tier 2 execute: product cascade ───────────────────────────────────
  async deleteProduct(publicId: string, phrase: string, actor: Actor) {
    if (phrase !== publicId) throw new BadRequestError('Frasa konfirmasi tidak cocok')
    const preview = await dangerService.previewProduct(publicId)
    if (preview.blocked) throw new ConflictError(preview.blockReason ?? 'Diblokir')

    const { data: base } = await supabaseAdmin
      .from(PRODUCTS)
      .select('id, name')
      .eq('public_id', publicId)
      .limit(1)
    if (!base || base.length === 0) throw new NotFoundError('Product not found')
    const internalId = base[0]!.id as string

    // Variants first (FK), then the product. Vault rows attached to the
    // product cascade at the database level (ON DELETE CASCADE).
    const { error: vErr, count: variantsDeleted } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .delete({ count: 'exact' })
      .eq('product_id', internalId)
    if (vErr) throw new Error(vErr.message)

    const { error: pErr } = await supabaseAdmin
      .from(PRODUCTS)
      .delete()
      .eq('public_id', publicId)
    if (pErr) throw new Error(pErr.message)

    await appendAudit({
      action: 'danger:product-delete',
      resourceType: 'danger',
      resourcePublicId: publicId,
      resourceName: preview.name,
      snapshotText: `Danger Zone: produk ${preview.name} + ${variantsDeleted ?? 0} varian dihapus oleh ${actorTag(actor)} ${nowId()}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
      diff: { ...preview, variantsDeleted: variantsDeleted ?? 0 },
    }).catch((e) => console.error('[audit] danger product-delete failed', e))

    return { publicId, name: preview.name, variantsDeleted: variantsDeleted ?? 0 }
  },

  // ─── Tier 2 execute: variant delete ────────────────────────────────────
  async deleteVariant(publicId: string, phrase: string, actor: Actor) {
    if (phrase !== publicId) throw new BadRequestError('Frasa konfirmasi tidak cocok')
    const preview = await dangerService.previewVariant(publicId)
    if (preview.blocked) throw new ConflictError(preview.blockReason ?? 'Diblokir')

    // Referencing vault rows and orders keep their rows with FK nulled
    // (ON DELETE SET NULL); snapshots on orders preserve buyer history.
    const { error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .delete()
      .eq('public_id', publicId)
    if (error) throw new Error(error.message)

    await appendAudit({
      action: 'danger:variant-delete',
      resourceType: 'danger',
      resourcePublicId: publicId,
      resourceName: preview.name,
      snapshotText: `Danger Zone: varian ${preview.name} dihapus oleh ${actorTag(actor)} ${nowId()}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
      diff: preview,
    }).catch((e) => console.error('[audit] danger variant-delete failed', e))

    return { publicId, name: preview.name }
  },

  // ─── Tier 3: export gate (vault AVAILABLE only) ─────────────────────────
  async buildExport(actor: Actor): Promise<{ csv: string; exportToken: string; count: number; truncated: boolean }> {
    const preview = await dangerService.previewPurge()
    const filter: ExportFilter = { kind: 'vault', cutoff: preview.cutoff }

    const { data, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select(VAULT_EXPORT_COLUMNS.join(','))
      .eq('status', 'AVAILABLE')
      .lt('created_at', preview.cutoff)
      .order('created_at', { ascending: true })
      .limit(5001)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Record<string, any>[]
    const truncated = rows.length > 5000
    const exported = rows.slice(0, 5000)

    const exp = Date.now() + DANGER.exportTtlMs
    const payload = b64encode({ ...filter, n: exported.length })
    const exp36 = exp.toString(36)
    const sig = await hmacSha256Hex(exportSecret(), `danger-export.${payload}.${exp36}`)

    await appendAudit({
      action: 'danger:export',
      resourceType: 'danger',
      snapshotText: `Danger Zone: ekspor stok basi (${exported.length} baris) oleh ${actorTag(actor)} ${nowId()}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
      diff: { kind: 'vault', cutoff: preview.cutoff, count: exported.length },
    }).catch((e) => console.error('[audit] danger export failed', e))

    return { csv: toCsv(VAULT_EXPORT_COLUMNS, exported), exportToken: `${payload}.${exp36}.${sig}`, count: exported.length, truncated }
  },

  // ─── Tier 3 execute: purge with burned export token ────────────────────
  async purge(exportToken: string, actor: Actor) {
    const parts = exportToken.split('.')
    if (parts.length !== 3) throw new BadRequestError('Token ekspor tidak valid')
    const [payload, exp36, sig] = parts
    const exp = parseInt(exp36!, 36)
    if (!Number.isFinite(exp) || exp < Date.now()) throw new BadRequestError('Token ekspor kedaluwarsa')

    const ok = await verifyHmacSha256Hex(exportSecret(), `danger-export.${payload}.${exp36}`, sig!).catch(() => false)
    if (!ok) throw new BadRequestError('Token ekspor tidak valid')

    const filter = b64decode<ExportFilter & { n: number }>(payload!)
    if (!filter || (filter.kind !== 'orders' && filter.kind !== 'vault')) {
      throw new BadRequestError('Token ekspor tidak valid')
    }

    // Single-use: first caller burns the signature, replays hit 23505.
    const fresh = await claimIdempotencyKey(`danger-export:${sig}`)
    if (!fresh) throw new ConflictError('Token ekspor sudah dipakai')

    // Re-resolve rows from the token's own filter at purge time, so the
    // token authorizes exactly what was exported - never client input.
    // Only vault AVAILABLE is purgeable; order filters are rejected even
    // if signed (a token minted before this policy stays invalid).
    if (filter.kind !== 'vault') throw new BadRequestError('Token ekspor tidak valid')

    const { data, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('id')
      .eq('status', 'AVAILABLE')
      .lt('created_at', filter.cutoff)
    if (error) throw new Error(error.message)
    const ids = (data ?? []).map((r: any) => r.id as string)

    const deleted = await deleteInBatches(VAULT_ITEMS, ids)

    await appendAudit({
      action: 'danger:purge',
      resourceType: 'danger',
      snapshotText: `Danger Zone: purge stok basi ${deleted} baris oleh ${actorTag(actor)} ${nowId()}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
      diff: { kind: 'vault', cutoff: filter.cutoff, deleted },
    }).catch((e) => console.error('[audit] danger purge failed', e))

    return { kind: 'vault' as const, deleted }
  },
}
