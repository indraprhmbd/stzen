import { z } from 'zod'

// ─── Checkout Schema ────────────────────────────────────────────────────────

export const CheckoutSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
})

export type Checkout = z.infer<typeof CheckoutSchema>
