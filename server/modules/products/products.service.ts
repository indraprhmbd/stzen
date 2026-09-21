import { supabaseAdmin } from '../../shared/db'
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/http'
import { getStockCount, getStockCounts } from '../../shared/lib/db-helpers'
import { generatePublicId } from '../../shared/lib/publicId'
import { generateSku, composeVariantName } from '../../shared/lib/sku'
import { appendAudit, claimIdempotencyKey, findAuditByIdempotencyKey, releaseIdempotencyKey } from '../../shared/lib/audit'
import {
  BULK_ROW_LIMIT,
  BULK_TEXT_LIMIT,
  BULK_ISSUE_CAP,
  parseCsvText,
  coerceInteger,
  coerceBoolean,
  checkSingleLine,
  checkMaxLength,
  bulkChecksum,
  issuesToCsv,
  type BulkColumn,
  type BulkIssue,
  type ParsedCsv,
} from '../../shared/lib/csvBulk'
import type { ProductWithStock, PaginatedCatalog, CatalogCard, ProductQueryParams } from './products.types'

function pickProductFields(variant: any): { category: string; description: string | null; overview: string | null; instructions: string | null; name: string; badge: string | null } {
  const product = Array.isArray(variant.products) ? variant.products[0] : (variant.products || variant.product || {})
  return {
    category: product?.category ?? '',
    description: product?.description ?? null,
    overview: product?.overview ?? null,
    instructions: product?.instructions ?? null,
    name: product?.name ?? '',
    badge: product?.badge ?? null,
  }
}

function mapVariantToProduct(variant: any, stockCount: number): ProductWithStock {
  const product = pickProductFields(variant)
  return {
    id: variant.public_id,
    name: variant.name,
    description: variant.description ?? product.description ?? null,
    category: product.category,
    price: String(variant.price),
    badge: variant.badge ?? product.badge ?? null,
    isActive: variant.is_active,
    stockCount,
    fulfillmentType: variant.fulfillment_type,
    requiresDeliveryInfo: variant.requires_delivery_info ?? false,
    compareAtPrice: variant.compare_at_price ?? null,
    overview: variant.overview ?? product.overview ?? null,
    instructions: product.instructions ?? null,
    createdAt: variant.created_at,
    updatedAt: variant.updated_at,
  }
}

function mapVariantToCard(variant: any, stockCount: number): CatalogCard {
  const product = pickProductFields(variant)
  return {
    id: variant.public_id,
    name: variant.name,
    overview: variant.overview ?? product.overview ?? null,
    category: product.category,
    price: String(variant.price),
    compareAtPrice: variant.compare_at_price ?? null,
    badge: variant.badge ?? product.badge ?? null,
    isActive: variant.is_active,
    stockCount,
    fulfillmentType: variant.fulfillment_type,
  }
}

function mapProductRow(row: any, stockCount: number): ProductWithStock {
  return {
    id: row.public_id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? '',
    price: String(row.price),
    badge: row.badge ?? null,
    isActive: row.is_active,
    stockCount,
    fulfillmentType: 'vault',
    requiresDeliveryInfo: false,
    compareAtPrice: row.compare_at_price ?? null,
    overview: row.overview ?? null,
    instructions: row.instructions ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Tag tokens ─────────────────────────────────────────────────────────────
// Normalizes ?tags= values to the trigger-written form (UPPER, trimmed,
// quote-stripped): matches tags text[] exactly, cap 10 to bound the OR list.
export function parseTagTokens(input: string[]): string[] {
  const seen = new Set<string>()
  for (const raw of input) {
    const t = raw.trim().toUpperCase().replace(/"/g, '')
    if (t) seen.add(t)
    if (seen.size >= 10) break
  }
  return [...seen]
}

export const productsService = {
  async listActive(category?: string): Promise<ProductWithStock[]> {
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id,
        public_id,
        sku,
        name,
        price,
        compare_at_price,
        badge,
        overview,
        description,
        duration_months,
        account_type,
        conditions,
        fulfillment_type,
        requires_delivery_info,
        is_active,
        product_id,
        created_at,
        updated_at,
        products (
          id,
          name,
          description,
          category,
          instructions,
          overview,
          badge
        )
      `)
      .eq('is_active', true)

    if (error) throw new Error(error.message)

    let filtered = (variants || []).filter((variant: any) => {
      if (!category) return true
      const cat = pickProductFields(variant).category
      return cat === category
    })

    const stockByVariant = await getStockCounts(filtered.map((v: any) => v.id))
    const withStock = filtered.map((variant: any) =>
      mapVariantToProduct(variant, stockByVariant.get(variant.id) ?? 0)
    )

    withStock.sort((a, b) => {
      const catA = a.category
      const catB = b.category
      if (catA !== catB) return catA.localeCompare(catB)
      return a.name.localeCompare(b.name)
    })
    return withStock.filter(item => item.stockCount > 0)
  },

  async getCategoryCounts(): Promise<{ categories: string[]; counts: Record<string, number> }> {
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id,
        fulfillment_type,
        products (
          category
        )
      `)
      .eq('is_active', true)

    if (error) throw new Error(error.message)

    const variantIds = (variants || []).map((v: any) => v.id)
    const stockByVariant = await getStockCounts(variantIds)

    const categoryMap = new Map<string, number>()
    for (const variant of variants || []) {
      const isSellable = variant.fulfillment_type === 'on_demand' || (stockByVariant.get(variant.id) ?? 0) > 0
      if (!isSellable) continue
      const cat = pickProductFields(variant).category
      if (!cat) continue
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
    }

    return {
      categories: Array.from(categoryMap.keys()),
      counts: Object.fromEntries(categoryMap),
    }
  },

  // Distinct tag tokens over sellable variants with counts, most-used first.
  // Reads the denormalized effective column (own, else inherited), so no
  // parent join is needed. Powers the FilterBar picker.
  async getTagCounts(): Promise<{ tags: string[]; counts: Record<string, number> }> {
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id,
        tags_effective,
        fulfillment_type
      `)
      .eq('is_active', true)

    if (error) throw new Error(error.message)

    const variantIds = (variants || []).map((v: any) => v.id)
    const stockByVariant = await getStockCounts(variantIds)

    const tagMap = new Map<string, number>()
    for (const variant of variants || []) {
      const isSellable = variant.fulfillment_type === 'on_demand' || (stockByVariant.get(variant.id) ?? 0) > 0
      if (!isSellable) continue
      const effective: string[] = Array.isArray(variant.tags_effective) ? variant.tags_effective : []
      for (const t of effective) tagMap.set(t, (tagMap.get(t) || 0) + 1)
    }

    const sorted = [...tagMap.entries()].sort((a, b) => b[1] - a[1])
    return {
      tags: sorted.map(([t]) => t),
      counts: Object.fromEntries(sorted),
    }
  },

  async listPaginated(params: ProductQueryParams): Promise<PaginatedCatalog> {
    const { category, tags, sort = 'newest', page = 1, limit = 24, search } = params
    const tokens = parseTagTokens(Array.isArray(tags) ? tags : tags ? [tags] : [])
    const offset = (page - 1) * limit

    // Lean card projection: only what ProductCard renders. description,
    // instructions, timestamps never leave the server on list responses
    // (detail keeps the full shape via getById).
    const CARD_COLUMNS = `
      id,
      public_id,
      name,
      price,
      compare_at_price,
      badge,
      overview,
      fulfillment_type,
      is_active,
      products (
        id,
        name,
        category,
        badge
      )
    `
    // Inner join when filtering by category so PostgREST drops non-matching
    // rows in SQL instead of shipping the table for a client-side filter.
    const select = category ? CARD_COLUMNS.replace('products (', 'products!inner (') : CARD_COLUMNS
    let query = supabaseAdmin
      .from('product_variants')
      .select(select)
      .eq('is_active', true)

    if (category) {
      query = query.eq('products.category', category)
    }
    if (tokens.length > 0) {
      // Single-column overlap (&&) on the trigger-maintained effective
      // tokens (own, else inherited): GIN-indexed, no cross-table or().
      query = query.overlaps('tags_effective', tokens)
    }
    if (search) {
      const like = `%${search.replace(/[%_]/g, (c) => `\\${c}`)}%`
      query = query.ilike('name', like)
    }

    // Sort vocabulary matches the storefront FilterBar exactly.
    // newest/price/name order in SQL; stock sorts need live counts so they
    // order in memory below (rows arrive newest-first, stable sort keeps
    // that order for ties).
    switch (sort) {
      case 'price':
      case 'price-asc':
        query = query.order('price', { ascending: true })
        break
      case 'price-desc':
        query = query.order('price', { ascending: false })
        break
      case 'name':
        query = query.order('name', { ascending: true })
        break
      case 'stock':
      case 'out_of_stock':
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    const { data: variants, error } = await query

    if (error) throw new Error(error.message)

    const stockByVariant = await getStockCounts((variants || []).map((v: any) => v.id))
    let withStock = (variants || []).map((variant: any) =>
      mapVariantToCard(variant, stockByVariant.get(variant.id) ?? 0)
    )

    if (sort === 'out_of_stock') {
      withStock = withStock.filter(v => v.fulfillmentType !== 'on_demand' && v.stockCount === 0)
    } else {
      withStock = withStock.filter(v => v.fulfillmentType === 'on_demand' || v.stockCount > 0)
      if (sort === 'stock') {
        withStock.sort((a, b) => b.stockCount - a.stockCount)
      }
    }

    // Total counts what the operator actually sees (post stock filter), so
    // the pager never points at pages emptied by the sellability filter.
    const total = withStock.length
    const paginated = withStock.slice(offset, offset + limit)

    return {
      products: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },

  async getById(publicId: string): Promise<ProductWithStock> {
    const { data: variants, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        id,
        public_id,
        sku,
        name,
        price,
        compare_at_price,
        badge,
        overview,
        description,
        duration_months,
        account_type,
        conditions,
        fulfillment_type,
        requires_delivery_info,
        is_active,
        product_id,
        created_at,
        updated_at,
        products (
          id,
          name,
          description,
          category,
          overview,
          badge
        )
      `)
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)

    if (variants && variants.length > 0) {
      const variant = variants[0]!
      const stockCount = await getStockCount(variant.id)
      return mapVariantToProduct(variant, stockCount)
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        public_id,
        name,
        description,
        category,
        instructions,
        overview,
        created_at,
        updated_at
      `)
      .eq('public_id', publicId)
      .limit(1)

    if (productError) throw new Error(productError.message)

    if (!product || product.length === 0) {
      throw new NotFoundError('Product not found')
    }

    const stockCount = await getStockCount(product[0]!.id)
    return mapProductRow(product[0], stockCount)
  },

  async listAll() {
    const { data: rows, error } = await supabaseAdmin
      .from('products')
      .select('public_id, id, name, description, category, price, badge, instructions, overview, is_active, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    return rows.map((r: any) => ({
      id: r.public_id,
      internalId: r.id,
      name: r.name,
      description: r.description ?? null,
      category: r.category ?? '',
      price: String(r.price),
      badge: r.badge ?? null,
      instructions: r.instructions ?? null,
      isActive: r.is_active,
      overview: r.overview ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  },

  async listAllVariants() {
    const { data: rows, error } = await supabaseAdmin
      .from('product_variants')
      .select(`
        public_id,
        id,
        sku,
        name,
        price,
        compare_at_price,
        badge,
        duration_months,
        account_type,
        conditions,
        fulfillment_type,
        is_active,
        product_id,
        created_at,
        products (
          id,
          name,
          category
        )
      `)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    const stockByVariant = await getStockCounts((rows || []).map((r: any) => r.id))

    return (rows || []).map((r: any) => ({
      ...r,
      stockCount: stockByVariant.get(r.id) ?? 0,
    }))
  },

  // ─── Bulk Import: Basis (create-only v1) ──────────────────────────────────
  // One entity, one table, one INSERT statement: the whole batch lands or
  // nothing does. Preview and commit share validateBasisRows; commit
  // re-parses the same csvText, never trusts preview output.
  // ─── Bulk Import: Varian (create-only v1) ───────────────────────────────
  // Same claim/commit/audit pattern as Basis, plus a parent batch-resolve:
  // basis public_ids resolve in ONE query; unknown parents become row errors.
  // Name composes deterministically (composeVariantName) so preview shows the
  // exact final name; SKU carries a random suffix, so preview shows a sample
  // marked as such and commit mints the real one.
}

export const VARIAN_BULK_COLUMNS: BulkColumn[] = [
  { header: 'basis', label: 'Induk', required: true, aliases: ['induk', 'parent', 'parent_id', 'basis_id'] },
  { header: 'duration', label: 'Durasi', required: true, aliases: ['durasi'] },
  { header: 'unit', label: 'Satuan', required: true, aliases: ['satuan'] },
  { header: 'account_type', label: 'Tipe Akun', aliases: ['tipe_akun', 'tipe'] },
  { header: 'tags', label: 'Tags', aliases: ['badge'] },
  { header: 'price', label: 'Harga', required: true, aliases: ['harga'] },
  { header: 'cost', label: 'Harga Beli', aliases: ['cost_price', 'harga_beli', 'modal'] },
  { header: 'is_active', label: 'Aktif', aliases: ['aktif', 'isactive'] },
  { header: 'requires_delivery_info', label: 'Minta Akun', aliases: ['delivery_info', 'minta_akun'] },
]

type VarianDurationUnit = 'day' | 'week' | 'month'

const VARIAN_UNIT_ALIASES: Record<string, VarianDurationUnit> = {
  hari: 'day', harian: 'day', day: 'day', days: 'day', d: 'day',
  minggu: 'week', mingguan: 'week', mgg: 'week', week: 'week', weeks: 'week', w: 'week',
  bulan: 'month', bulanan: 'month', bln: 'month', month: 'month', months: 'month', m: 'month',
}

const VARIAN_UNIT_LABEL: Record<VarianDurationUnit, string> = { day: 'Hari', week: 'Minggu', month: 'Bulan' }

export interface VarianBulkRow {
  row: number
  basis: string
  duration: number
  unit: VarianDurationUnit
  accountType: string | null
  tags: string | null
  price: number
  cost: number | null
  isActive: boolean
  deliveryInfo: boolean
}

export interface VarianBulkDecision extends VarianBulkRow {
  action: 'create'
  basisName: string
  name: string
  skuSample: string
  durationLabel: string
}

function coerceVarianUnit(raw: string, row: number): { value: VarianDurationUnit | null; issue: BulkIssue | null } {
  const key = raw.trim().toLowerCase()
  const value = VARIAN_UNIT_ALIASES[key] ?? null
  if (value) return { value, issue: null }
  return {
    value: null,
    issue: { row, column: 'unit', code: 'bad_unit', message: `Satuan tidak dikenal: isi hari, minggu, atau bulan`, severity: 'error' },
  }
}

export function varianBulkTemplate() {
  return {
    entity: 'varian',
    headers: VARIAN_BULK_COLUMNS.map((c) => c.header),
    headerLine: VARIAN_BULK_COLUMNS.map((c) => c.header).join(','),
    samples: [
      { basis: 'TULIS_ID_INDUK', duration: '1', unit: 'bulan', account_type: 'Private', tags: 'TERLARIS', price: '45000', cost: '30000', is_active: 'true', requires_delivery_info: 'false' },
      { basis: 'TULIS_ID_INDUK', duration: '7', unit: 'hari', account_type: 'Sharing', tags: '', price: '15000', cost: '', is_active: 'true', requires_delivery_info: 'true' },
    ],
    notes: [
      'Satu baris = satu varian baru di bawah induk basis (kolom basis = ID publik induk, lihat tab Basis).',
      'duration angka + unit hari/minggu/bulan (boleh juga day/week/month). Nama varian digabung otomatis.',
      'price angka bulat rupiah wajib, terima 0. account_type teks bebas.',
      'cost (harga beli) opsional, kosong = tak dihitung di laba.',
      'tags opsional, pisahkan dengan ; , kosong = ikut induk.',
      'SKU dibuat otomatis saat commit; pratinjau hanya menampilkan contoh.',
      'compare_at_price, conditions, description belum didukung: isi lewat dialog Edit setelah impor.',
      `Maksimal ${BULK_ROW_LIMIT} baris dan 1MB per impor.`,
    ],
    limits: { rows: BULK_ROW_LIMIT, bytes: BULK_TEXT_LIMIT },
  }
}

// Pure: no DB, no writes. Parent existence resolves in the service layer
// (one batched query); preview and commit share both steps.
export function validateVarianRows(parsed: ParsedCsv): { valid: VarianBulkRow[]; issues: BulkIssue[] } {
  const valid: VarianBulkRow[] = []
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

    const basis = v.basis ?? ''
    if (basis === '') fail('basis', 'required', 'ID induk wajib diisi')
    check(basis ? checkSingleLine(basis, r.row, 'basis', 'Induk') : null)

    const durationRaw = v.duration ?? ''
    if (durationRaw === '') {
      fail('duration', 'required', 'Durasi wajib diisi')
    }
    const duration = coerceInteger(durationRaw, r.row, 'duration', 'Durasi')
    check(durationRaw ? duration.issue : null)

    const unitRaw = v.unit ?? ''
    if (unitRaw === '') {
      fail('unit', 'required', 'Satuan wajib diisi')
    }
    const unit = coerceVarianUnit(unitRaw, r.row)
    check(unitRaw ? unit.issue : null)

    const accountRaw = v.account_type ?? ''
    check(checkMaxLength(accountRaw, r.row, 'account_type', 'Tipe Akun', 100))
    check(accountRaw ? checkSingleLine(accountRaw, r.row, 'account_type', 'Tipe Akun') : null)

    // Empty tags = ikut induk (null): same link-preserving rule as the
    // variant dialog submit.
    const tagsRaw = v.tags ?? ''
    check(checkMaxLength(tagsRaw, r.row, 'tags', 'Tags', 50))
    check(tagsRaw ? checkSingleLine(tagsRaw, r.row, 'tags', 'Tags') : null)

    const priceRaw = v.price ?? ''
    if (priceRaw === '') {
      fail('price', 'required', 'Harga wajib diisi')
    }
    const price = coerceInteger(priceRaw, r.row, 'price', 'Harga')
    check(priceRaw ? price.issue : null)

    const costRaw = v.cost ?? ''
    const cost = coerceInteger(costRaw, r.row, 'cost', 'Harga Beli')
    check(costRaw ? cost.issue : null)

    const active = coerceBoolean(v.is_active ?? '', r.row, 'is_active', 'Aktif')
    check(active.issue)

    const delivery = coerceBoolean(v.requires_delivery_info ?? '', r.row, 'requires_delivery_info', 'Minta Akun')
    check(delivery.issue)

    if (ok && basis && duration.value != null && unit.value) {
      const key = `${basis.toLowerCase()}\0${duration.value}\0${unit.value}\0${accountRaw.toLowerCase()}`
      const first = seen.get(key)
      if (first !== undefined) {
        issues.push({ row: r.row, column: 'basis', code: 'dup_in_file', message: `Kombinasi induk+durasi+tipe sama dengan baris ${first}, cek duplikat`, severity: 'warning' })
      } else {
        seen.set(key, r.row)
      }
    }

    if (!ok) continue
    valid.push({
      row: r.row,
      basis,
      duration: duration.value ?? 0,
      unit: unit.value ?? 'month',
      accountType: accountRaw === '' ? null : accountRaw,
      tags: tagsRaw === '' ? null : tagsRaw,
      price: price.value ?? 0,
      cost: costRaw === '' ? null : (cost.value ?? null),
      isActive: active.value ?? true,
      deliveryInfo: delivery.value ?? false,
    })
  }

  return { valid, issues }
}

// DB step: resolve parent public_ids in one batched query. Unknown parents
// become row errors; the returned map feeds name composition + decisions.
async function resolveVarianParents(valid: VarianBulkRow[]): Promise<{ kept: VarianBulkRow[]; parents: Map<string, { id: number; name: string }>; issues: BulkIssue[] }> {
  const issues: BulkIssue[] = []
  const ids = [...new Set(valid.map((d) => d.basis))]
  // Empty .in() is a PostgREST 400: skip the DB round-trip entirely so an
  // all-invalid file still returns row-level errors instead of a 500.
  if (ids.length === 0) return { kept: [], parents: new Map<string, { id: number; name: string }>(), issues }
  const { data, error } = await supabaseAdmin.from('products').select('id, public_id, name').in('public_id', ids)
  if (error) throw new Error(error.message)
  const parents = new Map((data || []).map((p: any) => [p.public_id as string, { id: p.id as number, name: p.name as string }]))
  const kept: VarianBulkRow[] = []
  for (const d of valid) {
    if (!parents.has(d.basis)) {
      issues.push({ row: d.row, column: 'basis', code: 'unknown_parent', message: `Induk ${d.basis} tidak ditemukan di tab Basis`, severity: 'error' })
      continue
    }
    kept.push(d)
  }
  return { kept, parents, issues }
}

function varianBulkSummary(
  valid: VarianBulkRow[],
  parents: Map<string, { id: number; name: string }>,
  issues: BulkIssue[],
  total: number,
  skipped: number,
  checksum: string,
) {
  const errors = issues.filter((e) => e.severity === 'error')
  const warnings = issues.filter((e) => e.severity === 'warning')
  const badRows = new Set(errors.map((e) => e.row))
  return {
    entity: 'varian',
    checksum,
    total,
    skipped,
    valid: valid.length,
    invalid: badRows.size,
    warnings: warnings.length,
    decisions: valid.map((d): VarianBulkDecision => {
      const baseName = parents.get(d.basis)?.name ?? ''
      return {
        ...d,
        action: 'create',
        basisName: baseName,
        name: composeVariantName(baseName, d.duration, d.unit, d.accountType, null),
        skuSample: generateSku(baseName, d.duration, d.unit, d.accountType),
        durationLabel: `${d.duration} ${VARIAN_UNIT_LABEL[d.unit]}`,
      }
    }),
    issues: issues.slice(0, BULK_ISSUE_CAP),
    issueTotal: issues.length,
    errorCsv: issuesToCsv(issues),
  }
}

async function runVarianBulkValidation(csvText: string) {
  const parsed = parseCsvText(csvText, VARIAN_BULK_COLUMNS)
  const { valid, issues } = validateVarianRows(parsed)
  const { kept, parents, issues: parentIssues } = await resolveVarianParents(valid)
  const all = [...issues, ...parentIssues]
  return { parsed, summary: varianBulkSummary(kept, parents, all, parsed.rows.length, parsed.skipped, bulkChecksum(csvText)), valid: kept, parents, issues: all }
}

export const varianBulkService = {
  template: varianBulkTemplate,

  async preview(csvText: string) {
    const { summary } = await runVarianBulkValidation(csvText)
    return summary
  },

  async commit(csvText: string, batchKey: string, actor: { sub: string; email?: string | null }) {
    const key = `bulk:varian:${batchKey}`
    const prior = await findAuditByIdempotencyKey(key).catch(() => null)
    if (prior) return { ...(prior as Record<string, unknown>), replay: true }

    const claimed = await claimIdempotencyKey(key).catch(() => null)
    if (claimed === false) {
      throw new ConflictError('Impor ini sedang diproses, tunggu hasilnya dulu')
    }

    let valid: VarianBulkRow[]
    let parents: Map<string, { id: number; name: string }>
    let summary: Awaited<ReturnType<typeof runVarianBulkValidation>>['summary']
    try {
      const out = await runVarianBulkValidation(csvText)
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

    const rows = valid!.map((d) => {
      const baseName = parents!.get(d.basis)?.name ?? ''
      return {
        public_id: generatePublicId(),
        product_id: parents!.get(d.basis)!.id,
        sku: generateSku(baseName, d.duration, d.unit, d.accountType),
        name: composeVariantName(baseName, d.duration, d.unit, d.accountType, null),
        price: d.price,
        cost_price: d.cost,
        compare_at_price: null,
        badge: d.tags,
        duration_months: d.duration,
        duration_unit: d.unit,
        account_type: d.accountType,
        fulfillment_type: 'vault',
        requires_delivery_info: d.deliveryInfo,
        is_active: d.isActive,
      }
    })
    const { data: inserted, error } = await supabaseAdmin.from('product_variants').insert(rows).select('public_id')
    if (error) {
      // Single-statement insert: failure lands zero rows, claim stays so a
      // blind retry reports already-processed instead of duplicating.
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictError('Bentrok ID unik saat impor, ulangi pratinjau lalu commit lagi')
      }
      throw new Error(error.message)
    }

    const result = {
      entity: 'varian',
      batchId: batchKey,
      checksum: summary!.checksum,
      total: summary!.total,
      committed: inserted?.length ?? 0,
    }
    await appendAudit({
      action: 'product:bulk-import',
      resourceType: 'variant',
      snapshotText: `Impor varian ${result.committed}/${result.total} baris oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
      diff: result,
      idempotencyKey: key,
    }).catch(() => {})
    return result
  },
}

export const BASIS_BULK_COLUMNS: BulkColumn[] = [
  { header: 'name', label: 'Nama', required: true, aliases: ['nama'] },
  { header: 'category', label: 'Kategori', required: true, aliases: ['kategori'] },
  { header: 'overview', label: 'Ringkasan', aliases: ['ringkasan'] },
  { header: 'tags', label: 'Tags', aliases: ['badge'] },
  { header: 'price', label: 'Harga', aliases: ['harga'] },
  { header: 'is_active', label: 'Aktif', aliases: ['aktif', 'isactive'] },
]

export interface BasisBulkRow {
  row: number
  name: string
  category: string
  overview: string | null
  badge: string | null
  price: number
  isActive: boolean
}

export interface BasisBulkDecision extends BasisBulkRow {
  action: 'create'
}

export function basisBulkTemplate() {
  return {
    entity: 'basis',
    headers: BASIS_BULK_COLUMNS.map((c) => c.header),
    headerLine: BASIS_BULK_COLUMNS.map((c) => c.header).join(','),
    samples: [
      { name: 'Netflix Premium', category: 'Streaming', overview: 'Akun premium 1 bulan', tags: 'TERLARIS', price: '45000', is_active: 'true' },
      { name: 'Canva Pro', category: 'Desain', overview: '', tags: '', price: '10000', is_active: 'true' },
    ],
    notes: [
      'Satu baris = satu induk baru. Kolom name dan category wajib.',
      'overview maksimal 200 karakter satu baris; tags maksimal 50, pisahkan dengan ; .',
      'price angka bulat rupiah, kosong = 0. is_active true/false, 1/0, atau ya/tidak.',
      'description dan instructions belum didukung: isi lewat dialog Edit setelah impor.',
      `Maksimal ${BULK_ROW_LIMIT} baris dan 1MB per impor.`,
    ],
    limits: { rows: BULK_ROW_LIMIT, bytes: BULK_TEXT_LIMIT },
  }
}

// Pure: no DB, no writes. Unit-tested directly; preview and commit share it.
export function validateBasisRows(parsed: ParsedCsv): { valid: BasisBulkRow[]; issues: BulkIssue[] } {
  const valid: BasisBulkRow[] = []
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

    const name = v.name ?? ''
    if (name === '') fail('name', 'required', 'Nama wajib diisi')
    check(name ? checkMaxLength(name, r.row, 'name', 'Nama', 200) : null)
    check(name ? checkSingleLine(name, r.row, 'name', 'Nama') : null)

    const category = v.category ?? ''
    if (category === '') fail('category', 'required', 'Kategori wajib diisi')
    check(category ? checkMaxLength(category, r.row, 'category', 'Kategori', 100) : null)
    check(category ? checkSingleLine(category, r.row, 'category', 'Kategori') : null)

    const overviewRaw = v.overview ?? ''
    check(checkMaxLength(overviewRaw, r.row, 'overview', 'Ringkasan', 200))
    check(overviewRaw ? checkSingleLine(overviewRaw, r.row, 'overview', 'Ringkasan') : null)

    const badgeRaw = v.tags ?? ''
    check(checkMaxLength(badgeRaw, r.row, 'tags', 'Tags', 50))
    check(badgeRaw ? checkSingleLine(badgeRaw, r.row, 'tags', 'Tags') : null)

    const price = coerceInteger(v.price ?? '', r.row, 'price', 'Harga')
    check(price.issue)

    const active = coerceBoolean(v.is_active ?? '', r.row, 'is_active', 'Aktif')
    check(active.issue)

    if (ok && name && category) {
      const key = `${name.toLowerCase()}\0${category.toLowerCase()}`
      const first = seen.get(key)
      if (first !== undefined) {
        issues.push({ row: r.row, column: 'name', code: 'dup_in_file', message: `Nama+kategori sama dengan baris ${first}, cek duplikat`, severity: 'warning' })
      } else {
        seen.set(key, r.row)
      }
    }

    if (!ok) continue
    valid.push({
      row: r.row,
      name,
      category,
      overview: overviewRaw === '' ? null : overviewRaw,
      badge: badgeRaw === '' ? null : badgeRaw,
      price: price.value ?? 0,
      isActive: active.value ?? true,
    })
  }

  return { valid, issues }
}

function basisBulkSummary(valid: BasisBulkRow[], issues: BulkIssue[], total: number, skipped: number, checksum: string) {
  const errors = issues.filter((e) => e.severity === 'error')
  const warnings = issues.filter((e) => e.severity === 'warning')
  const badRows = new Set(errors.map((e) => e.row))
  return {
    entity: 'basis',
    checksum,
    total,
    skipped,
    valid: valid.length,
    invalid: badRows.size,
    warnings: warnings.length,
    decisions: valid.map((d): BasisBulkDecision => ({ ...d, action: 'create' })),
    issues: issues.slice(0, BULK_ISSUE_CAP),
    issueTotal: issues.length,
    errorCsv: issuesToCsv(issues),
  }
}

async function runBasisBulkValidation(csvText: string) {
  const parsed = parseCsvText(csvText, BASIS_BULK_COLUMNS)
  const { valid, issues } = validateBasisRows(parsed)
  return { parsed, summary: basisBulkSummary(valid, issues, parsed.rows.length, parsed.skipped, bulkChecksum(csvText)), valid, issues }
}

export const basisBulkService = {
  template: basisBulkTemplate,

  async preview(csvText: string) {
    const { summary } = await runBasisBulkValidation(csvText)
    return summary
  },

  async commit(csvText: string, batchKey: string, actor: { sub: string; email?: string | null }) {
    const key = `bulk:basis:${batchKey}`
    const prior = await findAuditByIdempotencyKey(key).catch(() => null)
    if (prior) return { ...(prior as Record<string, unknown>), replay: true }

    const claimed = await claimIdempotencyKey(key).catch(() => null)
    if (claimed === false) {
      throw new ConflictError('Impor ini sedang diproses, tunggu hasilnya dulu')
    }

    let valid: BasisBulkRow[]
    let summary: ReturnType<typeof basisBulkSummary>
    try {
      const out = await runBasisBulkValidation(csvText)
      valid = out.valid
      summary = out.summary
    } catch (e) {
      await releaseIdempotencyKey(key).catch(() => {})
      throw e
    }
    const blocking = summary.issues.some((e) => e.severity === 'error')
    if (blocking) {
      await releaseIdempotencyKey(key).catch(() => {})
      const err = new BadRequestError(`Validasi gagal: ${summary.invalid} baris bermasalah, perbaiki dulu`) as BadRequestError & { issues?: BulkIssue[] }
      err.issues = summary.issues
      throw err
    }

    const rows = valid!.map((d) => ({
      public_id: generatePublicId(),
      name: d.name,
      category: d.category,
      overview: d.overview,
      description: null,
      badge: d.badge,
      instructions: null,
      price: d.price,
      is_active: d.isActive,
    }))
    const { data: inserted, error } = await supabaseAdmin.from('products').insert(rows).select('public_id')
    if (error) {
      // Single-statement insert: failure lands zero rows, claim stays so a
      // blind retry reports already-processed instead of duplicating.
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictError('Bentrok ID unik saat impor, ulangi pratinjau lalu commit lagi')
      }
      throw new Error(error.message)
    }

    const result = {
      entity: 'basis',
      batchId: batchKey,
      checksum: summary!.checksum,
      total: summary!.total,
      committed: inserted?.length ?? 0,
    }
    await appendAudit({
      action: 'product:bulk-import',
      resourceType: 'product',
      snapshotText: `Impor basis ${result.committed}/${result.total} baris oleh ${actor.email ?? actor.sub}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
      diff: result,
      idempotencyKey: key,
    }).catch(() => {})
    return result
  },
}

// ─── Bulk Status (checkbox selection: activate/deactivate) ────────────────
// Sequential per-id updates, one update-audit row per success, per-id skip
// reasons — same shape as orders bulkApprove. Default runners hit the DB
// and mirror the single PUT audit rows; tests inject run/audit stubs.

export interface BulkStatusActor {
  sub: string
  email?: string | null
}

export interface BulkStatusDeps {
  run?: (id: string, active: boolean) => Promise<{ publicId: string; name: string }>
  audit?: (row: { publicId: string; name: string }, actor: BulkStatusActor) => Promise<void>
}

export interface BulkStatusResult {
  scanned: number
  updated: number
  skipped: { id: string; reason: string }[]
}

async function runBulkStatus(
  ids: string[],
  active: boolean,
  actor: BulkStatusActor,
  deps: BulkStatusDeps,
): Promise<BulkStatusResult> {
  const run = deps.run!
  const audit = deps.audit!
  const skipped: { id: string; reason: string }[] = []
  let updated = 0
  for (const id of ids) {
    try {
      const row = await run(id, active)
      await audit(row, actor)
      updated++
    } catch (e: unknown) {
      skipped.push({ id, reason: e instanceof Error ? e.message : 'Gagal' })
    }
  }
  return { scanned: ids.length, updated, skipped }
}

async function setProductActive(id: string, active: boolean): Promise<{ publicId: string; name: string }> {
  const { data: rows, error } = await supabaseAdmin
    .from('products')
    .select('id, name, is_active')
    .eq('public_id', id)
    .limit(1)
  if (error) throw new Error(error.message)
  const row = rows?.[0]
  if (!row) throw new NotFoundError('Induk tidak ditemukan')
  if (row.is_active === active) throw new BadRequestError(active ? 'Sudah aktif' : 'Sudah nonaktif')
  const { error: updateError } = await supabaseAdmin
    .from('products')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('public_id', id)
  if (updateError) throw new Error(updateError.message)
  // Cascade mirrors single PUT /:id: children follow the parent.
  await supabaseAdmin
    .from('product_variants')
    .update({ is_active: active })
    .eq('product_id', row.id)
  return { publicId: id, name: row.name ?? '' }
}

async function setVariantActive(id: string, active: boolean): Promise<{ publicId: string; name: string }> {
  const { data: rows, error } = await supabaseAdmin
    .from('product_variants')
    .select('id, name, is_active')
    .eq('public_id', id)
    .limit(1)
  if (error) throw new Error(error.message)
  const row = rows?.[0]
  if (!row) throw new NotFoundError('Varian tidak ditemukan')
  if (row.is_active === active) throw new BadRequestError(active ? 'Sudah aktif' : 'Sudah nonaktif')
  const { error: updateError } = await supabaseAdmin
    .from('product_variants')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('public_id', id)
  if (updateError) throw new Error(updateError.message)
  return { publicId: id, name: row.name ?? '' }
}

function auditBulkStatus(action: 'product:update' | 'variant:update', label: string) {
  return (row: { publicId: string; name: string }, actor: BulkStatusActor): Promise<void> => {
    return appendAudit({
      action,
      resourceType: action === 'product:update' ? 'product' : 'variant',
      resourcePublicId: row.publicId,
      resourceName: row.name,
      snapshotText: `${label} ${row.name} diperbarui oleh ${actor.email ?? actor.sub} ${new Date().toLocaleString('id-ID')}`,
      actorId: actor.sub,
      actorEmail: actor.email ?? null,
      actorType: 'admin',
    }).catch(() => {})
  }
}

export const productStatusService = {
  async setActive(ids: string[], active: boolean, actor: BulkStatusActor, deps: BulkStatusDeps = {}): Promise<BulkStatusResult> {
    return runBulkStatus(ids, active, actor, {
      run: deps.run ?? setProductActive,
      audit: deps.audit ?? auditBulkStatus('product:update', 'Produk'),
    })
  },
}

export const variantStatusService = {
  async setActive(ids: string[], active: boolean, actor: BulkStatusActor, deps: BulkStatusDeps = {}): Promise<BulkStatusResult> {
    return runBulkStatus(ids, active, actor, {
      run: deps.run ?? setVariantActive,
      audit: deps.audit ?? auditBulkStatus('variant:update', 'Varian'),
    })
  },
}
