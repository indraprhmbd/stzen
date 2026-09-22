import { supabaseAdmin } from '../../shared/db'
import { getEnv } from '../../shared/lib/runtime-env'
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/http'
import { appendAudit, appendAuditMany, claimIdempotencyKey, findAuditByIdempotencyKey, releaseIdempotencyKey } from '../../shared/lib/audit'
import { insertWarrantyClaim } from '../../shared/lib/warranty'
import {
  BULK_ROW_LIMIT,
  BULK_TEXT_LIMIT,
  BULK_ISSUE_CAP,
  parseCsvText,
  checkSingleLine,
  checkMaxLength,
  bulkChecksum,
  issuesToCsv,
  type BulkColumn,
  type BulkIssue,
  type ParsedCsv,
} from '../../shared/lib/csvBulk'
import {
  importKeyFromBase64,
  encrypt,
  decrypt,
  type EncryptedPayload,
} from '../../shared/lib/crypto'

const VAULT_ITEMS = 'vault_items'
const PRODUCTS = 'products'
const PRODUCT_VARIANTS = 'product_variants'
const ORDERS = 'orders'

let cachedKey: CryptoKey | null = null
async function getKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    const aesSecret = getEnv('AES_SECRET_KEY')
    if (!aesSecret) throw new Error('AES_SECRET_KEY not configured')
    cachedKey = await importKeyFromBase64(aesSecret)
  }
  return cachedKey!
}

export const vaultService = {
  async importCredentials(variantOrProductId: string, credentialLines: string[]) {
    const { data: variant } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('*')
      .eq('id', variantOrProductId)
      .limit(1)

    let product: any = variant?.[0]
    let isVariant = !!variant && variant.length > 0
    if (!isVariant) {
      const { data: p } = await supabaseAdmin
        .from(PRODUCTS)
        .select('*')
        .eq('id', variantOrProductId)
        .limit(1)

      if (!p || p.length === 0) throw new NotFoundError('Product not found')
      product = p[0]
    }

    const key = await getKey()
    const encryptedItems: Array<any> = []

    for (const line of credentialLines) {
      const payload: EncryptedPayload = await encrypt(key, line)
      if (isVariant) {
        encryptedItems.push({
          variant_id: variantOrProductId,
          product_id: (product as any)?.product_id ?? null,
          credential_payload: JSON.stringify(payload),
          status: 'AVAILABLE',
        })
      } else {
        encryptedItems.push({
          product_id: variantOrProductId,
          credential_payload: JSON.stringify(payload),
          status: 'AVAILABLE',
        })
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .insert(encryptedItems)
      .select()

    if (error) throw new Error(error.message)
    return { imported: inserted?.length || 0, productId: variantOrProductId }
  },

  async decryptCredential(encryptedPayload: string): Promise<string> {
    const key = await getKey()
    const payload: EncryptedPayload = JSON.parse(encryptedPayload)
    return decrypt(key, payload)
  },

  async listByVariant(variantPublicId: string, page: number, orderQuery?: string, sort?: string, sortDir?: string, limitParam?: number) {
    const limit = Math.min(Math.max(limitParam || 25, 10), 100)
    const offset = Math.max(0, page) * limit

    const { data: variants, error } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('id, fulfillment_type')
      .eq('public_id', variantPublicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!variants || variants.length === 0) throw new NotFoundError('Variant not found')

    const variantId = variants[0]!.id
    const fulfillmentType = variants[0]!.fulfillment_type || 'vault'

    let query = supabaseAdmin
      .from(VAULT_ITEMS)
      .select(`
        id,
        status,
        created_at,
        allocated_at,
        credential_payload,
        orders (
          public_id,
          status
        )
      `)
      .eq('variant_id', variantId)

    // Sort key honored in SQL before .range(): sorting the fetched page in
    // memory would order rows within the page only. Unknown keys fall back
    // to created_at. Direction stays driven by sortDir (default desc).
    const VAULT_SORT_COLUMNS: Record<string, string> = { status: 'status', createdAt: 'created_at' }
    query = query.order(VAULT_SORT_COLUMNS[sort ?? ''] ?? 'created_at', { ascending: sortDir === 'asc' })

    // orderQuery matches order public_ids. vault_items has no order FK, so
    // resolve matching vault_item_ids via orders first, then constrain by
    // id - filtering the fetched page in memory would break paging.
    if (orderQuery) {
      const raw = orderQuery.replace(/[%_]/g, (c) => `\\${c}`)
      const { data: orderRows, error: orderError } = await supabaseAdmin
        .from(ORDERS)
        .select('vault_item_id')
        .ilike('public_id', `%${raw}%`)
        .limit(200)
      if (orderError) throw new Error(orderError.message)
      const ids = [...new Set((orderRows || []).map((r: any) => r.vault_item_id).filter(Boolean))]
      if (ids.length === 0) {
        return { items: [], page, hasMore: false, total: 0, counts: {} }
      }
      query = query.in('id', ids)
    }

    let rows: any[] = []
    const { data: rangeData, error: rangeError } = await query.range(offset, offset + limit)
    if (rangeError) throw new Error(rangeError.message)
    rows = rangeData || []

    const key = await getKey()
    const hasMore = (rows?.length || 0) > limit
    const items = await Promise.all(
      (rows || []).slice(0, limit).map(async (r: any) => {
        const order = Array.isArray(r.orders) ? r.orders[0] : (r.orders || {})
        return {
          id: r.id,
          status: r.status,
          createdAt: r.created_at,
          allocatedAt: r.allocated_at,
          credential: await decrypt(key, JSON.parse(r.credential_payload) as EncryptedPayload),
          orderPublicId: order?.public_id,
          orderStatus: order?.status,
          fulfillmentType,
        }
      })
    )

    // Count by status
    const { data: allItems } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('status')
      .eq('variant_id', variantId)

    const byStatus: Record<string, number> = {}
    for (const item of allItems || []) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1
    }

    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)

    return {
      items,
      page,
      hasMore,
      total,
      counts: byStatus,
    }
  },

  async updateCredential(id: string, text: string, actor: { sub: string; email?: string | null }) {
    const { data: item, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*')
      .eq('id', id)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!item || item.length === 0) throw new NotFoundError('Credential not found')
    if (item[0].status !== 'AVAILABLE') throw new ConflictError('Only AVAILABLE credentials can be edited')

    const key = await getKey()
    const payload = await encrypt(key, text)

    const { error: updateError } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .update({ credential_payload: JSON.stringify(payload) })
      .eq('id', id)

    if (updateError) throw new Error(updateError.message)

    await appendAudit({
      action: 'vault:update',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault diperbarui oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return { id }
  },

  async deleteAvailable(id: string, actor: { sub: string; email?: string | null }) {
    const { data: item, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*')
      .eq('id', id)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!item || item.length === 0) throw new NotFoundError('Credential not found')
    if (item[0].status !== 'AVAILABLE') throw new ConflictError('Only AVAILABLE credentials can be deleted')

    const { error: deleteError } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .delete()
      .eq('id', id)

    if (deleteError) throw new Error(deleteError.message)

    await appendAudit({
      action: 'vault:delete',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault dihapus oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return { id }
  },

  async revoke(id: string, actor: { sub: string; email?: string | null }) {
    const { data: item, error } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .select('*')
      .eq('id', id)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!item || item.length === 0) throw new NotFoundError('Credential not found')
    const status = item[0].status
    if (status !== 'SOLD' && status !== 'AVAILABLE') throw new ConflictError('Only delivered or available credentials can be revoked')
    // SOLD rows belong to a buyer order: revoking here would orphan the
    // DELIVERED order (no working credential, no undo). Force the Ganti
    // path, which revokes + reallocates atomically.
    if (status === 'SOLD') {
      const refs = await findOrderRefs([id])
      if (refs.has(id)) throw new ConflictError('Kredensial terikat order, gunakan Ganti akses')
    }

    const { error: updateError } = await supabaseAdmin
      .from(VAULT_ITEMS)
      .update({ status: 'REVOKED' })
      .eq('id', id)

    if (updateError) throw new Error(updateError.message)

    await appendAudit({
      action: 'vault:revoke',
      resourceType: 'stock',
      resourcePublicId: id,
      snapshotText: `Kredensial vault dicabut oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    return { id }
  },

  async replace(orderPublicId: string, actor: { sub: string; email?: string | null }, opts?: { credential?: string | null; fallbackVariantId?: string | null }) {
    const { data: orderRows, error } = await supabaseAdmin
      .from(ORDERS)
      .select('*')
      .eq('public_id', orderPublicId)
      .limit(1)

    if (error) throw new Error(error.message)
    if (!orderRows || orderRows.length === 0) throw new NotFoundError('Order not found')

    const order = orderRows[0] as any
    if (order.status !== 'DELIVERED') throw new ConflictError('Only DELIVERED orders can rotate credentials')
    if (!order.vault_item_id) throw new ConflictError('Order has no credential allocated')
    if (!order.variant_id) throw new ConflictError('Order has no variant linked')

    const oldId = order.vault_item_id

    // Mark old credential revoked first
    await supabaseAdmin
      .from(VAULT_ITEMS)
      .update({ status: 'REVOKED' })
      .eq('id', oldId)

    // Order-keyed trace: bare vault:revoke rows are keyed by vault row id
    // (resourceType stock), so the order Riwayat never sees them. This row
    // lands even when allocation below throws STOK_HABIS — otherwise a
    // failed Ganti orphans the order with zero history.
    await appendAudit({
      action: 'vault:revoke',
      resourceType: 'order',
      resourcePublicId: orderPublicId,
      snapshotText: `Kredensial order dicabut oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    // Detect fulfillment type
    const { data: variantRow } = await supabaseAdmin
      .from(PRODUCT_VARIANTS)
      .select('fulfillment_type')
      .eq('id', order.variant_id)
      .limit(1)

    const fulfillmentType = variantRow?.[0]?.fulfillment_type || 'vault'

    // On-demand: never use pooled stock; require manual credential
    if (fulfillmentType === 'on_demand') {
      const credential = (opts?.credential || '').trim()
      if (!credential) {
        throw new ConflictError('ON_DEMAND_REQUIRES_CREDENTIAL')
      }

      const aesSecret = getEnv('AES_SECRET_KEY')
      if (!aesSecret) throw new Error('AES_SECRET_KEY not configured')
      const key = await importKeyFromBase64(aesSecret)
      const payload = await encrypt(key, credential)

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from(VAULT_ITEMS)
        .insert({
          variant_id: order.variant_id,
          product_id: order.product_id ?? null,
          credential_payload: JSON.stringify(payload),
          status: 'SOLD',
        })
        .select('id')
        .single()

      if (insertError) throw new Error(insertError.message)

      await supabaseAdmin
        .from(ORDERS)
        .update({ vault_item_id: inserted.id })
        .eq('id', order.id)

      await appendAudit({
        action: 'order:replace',
        resourceType: 'order',
        resourcePublicId: orderPublicId,
        snapshotText: `Kredensial order diganti oleh ${actor.email ?? actor.sub}`,
        actorId: actor.sub,
        actorEmail: actor.email ?? null,
        actorType: 'admin',
      }).catch(() => {})

      // Rotate counts as a warranty claim (single source: warranty_claims).
      await insertWarrantyClaim(order.id, actor, 'Rotasi kredensial').catch(() => {})

      return { oldId, newId: inserted.id }
    }

    // Vault flow: try RPC, then fallbacks
    let newId: string | null = null

    // 1) Try auto-replace on the same variant
    if (!newId) {
      try {
        const { data: result } = await supabaseAdmin.rpc('replace_order_credential', {
          p_variant_id: order.variant_id,
          p_order_id: order.id,
        })
        if (result && result.length > 0) {
          newId = result[0].newId
        }
      } catch {
        // ignore, try fallbacks below
      }
    }

    // 2) Try explicit fallback variant
    if (!newId && opts?.fallbackVariantId) {
      try {
        const { data: result } = await supabaseAdmin.rpc('replace_order_credential', {
          p_variant_id: opts.fallbackVariantId,
          p_order_id: order.id,
        })
        if (result && result.length > 0) {
          newId = result[0].newId
        }
      } catch {
        // ignore
      }
    }

    // 3) Manual credential fallback: encrypt and insert as new SOLD vault item
    if (!newId && opts?.credential && opts.credential.trim()) {
      const aesSecret = getEnv('AES_SECRET_KEY')
      if (!aesSecret) throw new Error('AES_SECRET_KEY not configured')
      const key = await importKeyFromBase64(aesSecret)
      const payload = await encrypt(key, opts.credential.trim())

      const targetVariantId = opts.fallbackVariantId || order.variant_id

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from(VAULT_ITEMS)
        .insert({
          variant_id: targetVariantId,
          product_id: order.product_id ?? null,
          credential_payload: JSON.stringify(payload),
          status: 'SOLD',
        })
        .select('id')
        .single()

      if (insertError) throw new Error(insertError.message)
      newId = inserted.id
    }

    if (!newId) {
      throw new ConflictError('STOK_HABIS: no replacement stock for this variant')
    }

    await supabaseAdmin
      .from(ORDERS)
      .update({ vault_item_id: newId })
      .eq('id', order.id)

    await appendAudit({
      action: 'order:replace',
      resourceType: 'order',
      resourcePublicId: orderPublicId,
      snapshotText: `Kredensial order diganti oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})

    // Rotate counts as a warranty claim (single source: warranty_claims).
    await insertWarrantyClaim(order.id, actor, 'Rotasi kredensial').catch(() => {})

    return { oldId, newId }
  },
}

// ─── Bulk Import: Stok (create-only v1) ───────────────────────────────────
// One CSV row = one credential for one variant. Secrets NEVER come back:
// preview decisions carry only a masked length, never the credential text.
// variant_ref accepts a variant public_id or SKU (public_id wins ties).
// Parents resolve in ONE batched query; unknown refs and on_demand variants
// become row errors. Commit encrypts all rows then lands one INSERT.

export const STOK_BULK_COLUMNS: BulkColumn[] = [
  { header: 'variant_ref', label: 'Varian', required: true, aliases: ['varian', 'variant', 'variant_id', 'sku'] },
  { header: 'credential', label: 'Kredensial', required: true, aliases: ['kredensial'] },
]

export interface StokBulkRow {
  row: number
  variantRef: string
  credential: string
}

export interface StokBulkDecision {
  row: number
  variantRef: string
  variantName: string
  masked: string
  action: 'create'
}

// Masked preview: length only, zero secret content. Shared by decisions.
export function maskCredential(credential: string): string {
  return `•••••• (${credential.length} karakter)`
}

export function stokBulkTemplate() {
  return {
    entity: 'stok',
    headers: STOK_BULK_COLUMNS.map((c) => c.header),
    headerLine: STOK_BULK_COLUMNS.map((c) => c.header).join(','),
    samples: [
      { variant_ref: 'TULIS_ID_ATAU_SKU', credential: 'user001@example.com:Passw0rd!' },
      { variant_ref: 'TULIS_ID_ATAU_SKU', credential: 'AKUN-2026-ABCD-EFGH' },
    ],
    notes: [
      'Satu baris = satu kredensial untuk satu varian. variant_ref = ID publik atau SKU varian.',
      'Kredensial satu baris, tidak boleh kosong. Format bebas: email:password, PIN, atau kode lisensi.',
      'Pratinjau TIDAK pernah menampilkan isi kredensial, hanya panjangnya.',
      'Varian on demand tidak punya stok: barisnya ditolak.',
      `Maksimal ${BULK_ROW_LIMIT} baris dan 1MB per impor.`,
    ],
    limits: { rows: BULK_ROW_LIMIT, bytes: BULK_TEXT_LIMIT },
  }
}

// Pure: no DB, no writes, no secrets returned beyond the input rows
// themselves (preview masks before responding). Parent existence +
// on_demand guard resolve in the service layer (one batched query).
export function validateStokRows(parsed: ParsedCsv): { valid: StokBulkRow[]; issues: BulkIssue[] } {
  const valid: StokBulkRow[] = []
  const issues: BulkIssue[] = []
  const seen = new Map<string, number>()

  for (const r of parsed.rows) {
    const v = r.values
    let ok = true
    const fail = (column: string, code: string, message: string) => {
      ok = false
      issues.push({ row: r.row, column, code, message, severity: 'error' })
    }
    const check = (issue: BulkIssue | null) => {
      if (!issue) return
      if (issue.severity === 'error') ok = false
      issues.push(issue)
    }

    const ref = v.variant_ref ?? ''
    if (ref === '') fail('variant_ref', 'required', 'Referensi varian wajib diisi')
    check(ref ? checkSingleLine(ref, r.row, 'variant_ref', 'Varian') : null)

    const cred = v.credential ?? ''
    if (cred === '') {
      fail('credential', 'required', 'Kredensial wajib diisi')
    } else {
      check(checkSingleLine(cred, r.row, 'credential', 'Kredensial'))
      check(checkMaxLength(cred, r.row, 'credential', 'Kredensial', 2000))
    }

    if (ok && ref && cred) {
      const key = `${ref.toLowerCase()}\0${cred}`
      const first = seen.get(key)
      if (first !== undefined) {
        issues.push({ row: r.row, column: 'credential', code: 'dup_in_file', message: `Kredensial sama dengan baris ${first}, cek duplikat`, severity: 'warning' })
      } else {
        seen.set(key, r.row)
      }
    }

    if (!ok) continue
    valid.push({ row: r.row, variantRef: ref, credential: cred })
  }

  return { valid, issues }
}

interface StokParent {
  id: number
  publicId: string
  name: string
  fulfillmentType: string
  productId: number
}

// DB step: resolve refs (public_id first, then SKU) in one batched query.
// Unknown refs and on_demand variants become row errors.
async function resolveStokVariants(valid: StokBulkRow[]): Promise<{ kept: StokBulkRow[]; parents: Map<string, StokParent>; issues: BulkIssue[] }> {
  const issues: BulkIssue[] = []
  const refs = [...new Set(valid.map((d) => d.variantRef))]
  // Empty .in() is a PostgREST 400: skip the DB round-trip entirely so an
  // all-invalid file still returns row-level errors instead of a 500.
  if (refs.length === 0) return { kept: [], parents: new Map<string, StokParent>(), issues }
  const [{ data: byPublicRows, error: errPub }, { data: bySkuRows, error: errSku }] = await Promise.all([
    supabaseAdmin.from(PRODUCT_VARIANTS).select('id, public_id, sku, name, fulfillment_type, product_id').in('public_id', refs),
    supabaseAdmin.from(PRODUCT_VARIANTS).select('id, public_id, sku, name, fulfillment_type, product_id').in('sku', refs),
  ])
  if (errPub) throw new Error(errPub.message)
  if (errSku) throw new Error(errSku.message)
  const byPublic = new Map<string, any>()
  const bySku = new Map<string, any>()
  for (const v of byPublicRows || []) byPublic.set(v.public_id, v)
  for (const v of bySkuRows || []) bySku.set(v.sku, v)
  const parents = new Map<string, StokParent>()
  const kept: StokBulkRow[] = []
  for (const d of valid) {
    const v = byPublic.get(d.variantRef) ?? bySku.get(d.variantRef)
    if (!v) {
      issues.push({ row: d.row, column: 'variant_ref', code: 'unknown_variant', message: `Varian ${d.variantRef} tidak ditemukan (cek ID atau SKU)`, severity: 'error' })
      continue
    }
    if (v.fulfillment_type === 'on_demand') {
      issues.push({ row: d.row, column: 'variant_ref', message: `Varian ${v.name} on demand, tidak butuh stok`, code: 'on_demand', severity: 'error' })
      continue
    }
    parents.set(d.variantRef, { id: v.id, publicId: v.public_id, name: v.name, fulfillmentType: v.fulfillment_type, productId: v.product_id })
    kept.push(d)
  }
  return { kept, parents, issues }
}

function stokBulkSummary(
  valid: StokBulkRow[],
  parents: Map<string, StokParent>,
  issues: BulkIssue[],
  total: number,
  skipped: number,
  checksum: string,
) {
  const errors = issues.filter((e) => e.severity === 'error')
  const warnings = issues.filter((e) => e.severity === 'warning')
  const badRows = new Set(errors.map((e) => e.row))
  return {
    entity: 'stok',
    checksum,
    total,
    skipped,
    valid: valid.length,
    invalid: badRows.size,
    warnings: warnings.length,
    // Masked: length only, zero secret content leaves the server.
    decisions: valid.map((d): StokBulkDecision => ({
      row: d.row,
      variantRef: d.variantRef,
      variantName: parents.get(d.variantRef)?.name ?? '',
      masked: maskCredential(d.credential),
      action: 'create',
    })),
    issues: issues.slice(0, BULK_ISSUE_CAP),
    issueTotal: issues.length,
    errorCsv: issuesToCsv(issues),
  }
}

async function runStokBulkValidation(csvText: string) {
  const parsed = parseCsvText(csvText, STOK_BULK_COLUMNS)
  const { valid, issues } = validateStokRows(parsed)
  const { kept, parents, issues: refIssues } = await resolveStokVariants(valid)
  const all = [...issues, ...refIssues]
  return { parsed, summary: stokBulkSummary(kept, parents, all, parsed.rows.length, parsed.skipped, bulkChecksum(csvText)), valid: kept, parents, issues: all }
}

export const stokBulkService = {
  template: stokBulkTemplate,

  async preview(csvText: string) {
    const { summary } = await runStokBulkValidation(csvText)
    return summary
  },

  async commit(csvText: string, batchKey: string, actor: { sub: string; email?: string | null }) {
    const key = `bulk:stok:${batchKey}`
    const prior = await findAuditByIdempotencyKey(key).catch(() => null)
    if (prior) return { ...(prior as Record<string, unknown>), replay: true }

    const claimed = await claimIdempotencyKey(key).catch(() => null)
    if (claimed === false) {
      throw new ConflictError('Impor ini sedang diproses, tunggu hasilnya dulu')
    }

    let valid: StokBulkRow[]
    let parents: Map<string, StokParent>
    let summary: Awaited<ReturnType<typeof runStokBulkValidation>>['summary']
    try {
      const out = await runStokBulkValidation(csvText)
      valid = out.valid
      parents = out.parents
      summary = out.summary
    } catch (e) {
      await releaseIdempotencyKey(key).catch(() => {})
      throw e
    }
    const blocking = summary!.issues.some((e) => e.severity === 'error')
    if (blocking) {
      await releaseIdempotencyKey(key).catch(() => {})
      const err = new BadRequestError(`Validasi gagal: ${summary!.invalid} baris bermasalah, perbaiki dulu`) as BadRequestError & { issues?: BulkIssue[] }
      err.issues = summary!.issues
      throw err
    }

    const aesSecret = getEnv('AES_SECRET_KEY')
    if (!aesSecret) {
      await releaseIdempotencyKey(key).catch(() => {})
      throw new Error('AES_SECRET_KEY not configured')
    }
    const cryptoKey = await importKeyFromBase64(aesSecret)
    const encryptedItems: Array<any> = []
    for (const d of valid!) {
      const payload = await encrypt(cryptoKey, d.credential)
      encryptedItems.push({
        variant_id: parents!.get(d.variantRef)!.id,
        product_id: parents!.get(d.variantRef)!.productId,
        credential_payload: JSON.stringify(payload),
        status: 'AVAILABLE',
      })
    }
    const { data: inserted, error } = await supabaseAdmin.from(VAULT_ITEMS).insert(encryptedItems).select('id')
    if (error) {
      // Single-statement insert: failure lands zero rows, claim stays so a
      // blind retry reports already-processed instead of duplicating.
      throw new Error(error.message)
    }

    const perVariant = new Map<string, number>()
    for (const d of valid!) {
      const name = parents!.get(d.variantRef)?.name ?? d.variantRef
      perVariant.set(name, (perVariant.get(name) ?? 0) + 1)
    }
    const result = {
      entity: 'stok',
      batchId: batchKey,
      checksum: summary!.checksum,
      total: summary!.total,
      committed: inserted?.length ?? 0,
      perVariant: [...perVariant.entries()].map(([name, count]) => ({ name, count })),
    }
    await appendAudit({
      action: 'stock:import',
      resourceType: 'stock',
      snapshotText: `Impor stok ${result.committed}/${result.total} kredensial oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
      diff: result,
      idempotencyKey: key,
    }).catch(() => {})
    return result
  },
}

// ─── Bulk Actions (checkbox selection: delete + revoke) ───────────────────
// Set-based, constant ~4 PostgREST roundtrips per batch regardless of size:
// 1× fetch rows IN(ids), 1× order refs IN(ids), 1× write IN(eligible),
// 1× batched audit INSERT. The old sequential per-id loop (4 roundtrips ×
// N) blew past the Cloudflare free 50-subrequest cap and died mid-batch
// around item 12 — partial deletes + client timeout. Per-id skip reasons
// preserved in input order; single-statement writes are all-or-nothing so
// a write failure throws instead of silently half-applying. Default
// runners hit the DB; tests inject batched stubs.

export interface VaultBulkActor {
  sub: string
  email?: string | null
}

interface BulkRow {
  id: string
  status: string
  allocated_at: string | null
}

export interface VaultBulkDeps {
  fetchRows?: (ids: string[]) => Promise<Map<string, BulkRow>>
  findRefs?: (ids: string[]) => Promise<Set<string>>
  writeDelete?: (ids: string[]) => Promise<void>
  writeRevoke?: (ids: string[]) => Promise<void>
  auditMany?: (ids: string[], actor: VaultBulkActor) => Promise<void>
}

export interface VaultBulkResult {
  scanned: number
  processed: number
  skipped: { id: string; reason: string }[]
}

async function fetchBulkRows(ids: string[]): Promise<Map<string, BulkRow>> {
  const { data, error } = await supabaseAdmin
    .from(VAULT_ITEMS)
    .select('id, status, allocated_at')
    .in('id', ids)
  if (error) throw new Error(error.message)
  return new Map(((data ?? []) as BulkRow[]).map((r) => [r.id, r]))
}

async function findOrderRefs(ids: string[]): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from(ORDERS)
    .select('vault_item_id')
    .in('vault_item_id', ids)
    .limit(ids.length)
  if (error) throw new Error(error.message)
  return new Set(
    ((data ?? []) as { vault_item_id: string | null }[])
      .map((r) => r.vault_item_id)
      .filter((v): v is string => !!v)
  )
}

async function writeDeleteIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabaseAdmin
    .from(VAULT_ITEMS)
    .delete()
    .in('id', ids)
  if (error) throw new Error(error.message)
}

async function writeRevokeIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabaseAdmin
    .from(VAULT_ITEMS)
    .update({ status: 'REVOKED' })
    .in('id', ids)
  if (error) throw new Error(error.message)
}

async function defaultAuditMany(action: 'vault:delete' | 'vault:revoke', verb: string, ids: string[], actor: VaultBulkActor): Promise<void> {
  await appendAuditMany(ids.map((id) => ({
    action,
    resourceType: 'stock' as const,
    resourcePublicId: id,
    snapshotText: `Kredensial vault ${verb} oleh ${actor.email ?? actor.sub}`,
    actorId: actor.sub,
    actorEmail: actor.email ?? null,
    actorType: 'admin' as const,
  }))).catch(() => {})
}

export const vaultBulkService = {
  async remove(ids: string[], actor: VaultBulkActor, deps: VaultBulkDeps = {}): Promise<VaultBulkResult> {
    const uniq = [...new Set(ids)]
    if (uniq.length === 0) return { scanned: 0, processed: 0, skipped: [] }
    const fetchRows = deps.fetchRows ?? fetchBulkRows
    const findRefs = deps.findRefs ?? findOrderRefs
    const writeDelete = deps.writeDelete ?? writeDeleteIds
    const auditMany = deps.auditMany ?? ((ids: string[], a: VaultBulkActor) => defaultAuditMany('vault:delete', 'dihapus', ids, a))
    const [rows, refs] = await Promise.all([fetchRows(uniq), findRefs(uniq)])
    const eligible: string[] = []
    const skipped: { id: string; reason: string }[] = []
    for (const id of uniq) {
      const row = rows.get(id)
      if (!row) skipped.push({ id, reason: 'Kredensial tidak ditemukan' })
      else if (row.status !== 'AVAILABLE') skipped.push({ id, reason: 'Hanya AVAILABLE yang bisa dihapus' })
      // Untouched = never allocated: no timestamp AND no order pointing at it.
      else if (row.allocated_at) skipped.push({ id, reason: 'Sudah pernah dialokasikan' })
      else if (refs.has(id)) skipped.push({ id, reason: 'Terikat order' })
      else eligible.push(id)
    }
    await writeDelete(eligible)
    await auditMany(eligible, actor)
    return { scanned: uniq.length, processed: eligible.length, skipped }
  },

  async revokeMany(ids: string[], actor: VaultBulkActor, deps: VaultBulkDeps = {}): Promise<VaultBulkResult> {
    const uniq = [...new Set(ids)]
    if (uniq.length === 0) return { scanned: 0, processed: 0, skipped: [] }
    const fetchRows = deps.fetchRows ?? fetchBulkRows
    const findRefs = deps.findRefs ?? findOrderRefs
    const writeRevoke = deps.writeRevoke ?? writeRevokeIds
    const auditMany = deps.auditMany ?? ((ids: string[], a: VaultBulkActor) => defaultAuditMany('vault:revoke', 'dicabut', ids, a))
    const [rows, refs] = await Promise.all([fetchRows(uniq), findRefs(uniq)])
    const eligible: string[] = []
    const skipped: { id: string; reason: string }[] = []
    for (const id of uniq) {
      const row = rows.get(id)
      if (!row) skipped.push({ id, reason: 'Kredensial tidak ditemukan' })
      // Mirrors single POST /:id/revoke: delivered or available flip to REVOKED.
      else if (row.status !== 'SOLD' && row.status !== 'AVAILABLE') skipped.push({ id, reason: 'Hanya SOLD atau AVAILABLE yang bisa dicabut' })
      // SOLD rows bound to an order must go through Ganti (revoke+replace),
      // never bare revoke — otherwise the DELIVERED order is orphaned.
      else if (row.status === 'SOLD' && refs.has(id)) skipped.push({ id, reason: 'Terikat order, gunakan Ganti akses' })
      else eligible.push(id)
    }
    await writeRevoke(eligible)
    await auditMany(eligible, actor)
    return { scanned: uniq.length, processed: eligible.length, skipped }
  },
}
