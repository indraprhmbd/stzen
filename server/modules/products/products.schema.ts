import { z } from 'zod'

// ─── Product Schemas ────────────────────────────────────────────────────────

export const ProductCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
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

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type ProductCreate = z.infer<typeof ProductCreateSchema>
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>
export type BulkStock = z.infer<typeof BulkStockSchema>
