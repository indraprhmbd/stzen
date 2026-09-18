import { z } from 'zod'

// ─── Product Schemas ────────────────────────────────────────────────────────

export const ProductCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  overview: z.string().max(200).optional(),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required').max(100),
  price: z.string().regex(/^\d+$/, 'Price must be integer rupiah (e.g. 25000)').optional(),
  badge: z.string().max(50).optional(),
  instructions: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})

export const ProductUpdateSchema = ProductCreateSchema.partial()

// ─── Bulk Stock Schema ──────────────────────────────────────────────────────

export const BulkStockSchema = z.object({
  credentials: z
    .string()
    .min(1, 'Credentials list is required')
    .refine(
      (val) => val.split('\n').filter((l) => l.trim()).length > 0,
      'At least one credential line is required'
    ),
})

// ─── Storefront Query Schema ────────────────────────────────────────────────
// All-optional strings: only whitelists keys for the typed client, parsing
// stays manual in the route. Runtime behavior unchanged.

export const ProductQuerySchema = z.object({
  category: z.string().optional(),
  tags: z.string().optional(),
  sort: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
})

// ─── Bulk Import Schemas ────────────────────────────────────────────────────
// Shared shape for Basis/Varian/Stok bulk tabs: raw CSV text in, server
// parses authoritatively on preview AND commit (preview output never trusted
// for writes). 1MB text cap mirrors the parser limit.

export const BulkImportPreviewSchema = z.object({
  csvText: z.string().min(1, 'CSV kosong').max(1_048_576, 'CSV melebihi 1MB'),
})

export const BulkImportCommitSchema = BulkImportPreviewSchema.extend({
  batchKey: z.string().uuid('batchKey harus UUID'),
})

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type ProductCreate = z.infer<typeof ProductCreateSchema>
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>
export type BulkStock = z.infer<typeof BulkStockSchema>
