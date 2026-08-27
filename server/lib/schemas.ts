import { z } from 'zod'

// ─── Product Schemas ────────────────────────────────────────────────────────

export const ProductCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required').max(100),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid number (e.g. 9.99)'),
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

// ─── Checkout Schema ────────────────────────────────────────────────────────

export const CheckoutSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
})

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type ProductCreate = z.infer<typeof ProductCreateSchema>
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>
export type BulkStock = z.infer<typeof BulkStockSchema>
export type Checkout = z.infer<typeof CheckoutSchema>
