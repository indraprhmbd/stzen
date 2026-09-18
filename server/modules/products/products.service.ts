import { supabaseAdmin } from '../../shared/db'
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/http'
import { getStockCount, getStockCounts } from '../../shared/lib/db-helpers'
import { generatePublicId } from '../../shared/lib/publicId'
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
import type { ProductWithStock, PaginatedProducts, PaginatedCatalog, CatalogCard, ProductQueryParams } from './products.types'

function pickProductFields(variant: any): { category: string; description: string | null; overview: string | null; instructions: string | null; name: string } {
  const product = Array.isArray(variant.products) ? variant.products[0] : (variant.products || variant.product || {})
  return {
    category: product?.category ?? '',
    description: product?.description ?? null,
    overview: product?.overview ?? null,
    instructions: product?.instructions ?? null,
    name: product?.name ?? '',
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
    badge: variant.badge ?? null,
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
    badge: variant.badge ?? null,
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
          overview
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

  async listPaginated(params: ProductQueryParams): Promise<PaginatedCatalog> {
    const { category, tags, sort = 'newest', page = 1, limit = 24, search } = params
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
        category
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
    if (tags) {
      // Badge column stores ';'-separated promo tokens: substring match on
      // the single tapped token (same escaping as name search).
      const like = `%${tags.replace(/[%_]/g, (c) => `\\${c}`)}%`
      query = query.ilike('badge', like)
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
          overview
        )
      `)
      .eq('public_id', publicId)
      .limit(1)

    if (error) throw new Error(error.message)

    if (variants && variants.length > 0) {
      const variant = variants[0]
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

    const stockCount = await getStockCount(product[0].id)
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
}

export const BASIS_BULK_COLUMNS: BulkColumn[] = [
  { header: 'name', label: 'Nama', required: true, aliases: ['nama'] },
  { header: 'category', label: 'Kategori', required: true, aliases: ['kategori'] },
  { header: 'overview', label: 'Ringkasan', aliases: ['ringkasan'] },
  { header: 'badge', label: 'Badge' },
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
      { name: 'Netflix Premium', category: 'Streaming', overview: 'Akun premium 1 bulan', badge: 'TERLARIS', price: '45000', is_active: 'true' },
      { name: 'Canva Pro', category: 'Desain', overview: '', badge: '', price: '10000', is_active: 'true' },
    ],
    notes: [
      'Satu baris = satu induk baru. Kolom name dan category wajib.',
      'overview maksimal 200 karakter satu baris; badge maksimal 50.',
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

    const badgeRaw = v.badge ?? ''
    check(checkMaxLength(badgeRaw, r.row, 'badge', 'Badge', 50))
    check(badgeRaw ? checkSingleLine(badgeRaw, r.row, 'badge', 'Badge') : null)

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
