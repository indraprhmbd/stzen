import { z } from 'zod'

// ─── Checkout Schema ────────────────────────────────────────────────────────

export const CheckoutSchema = z.object({
  productId: z.string().regex(/^(?:[A-Za-z0-9_-]{12}|[0-9a-fA-F-]{36})$/, 'Invalid product ID'),
})

export type Checkout = z.infer<typeof CheckoutSchema>
