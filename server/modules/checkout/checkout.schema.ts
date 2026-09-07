import { z } from 'zod'

// ─── Checkout Schema ────────────────────────────────────────────────────────

export const CheckoutSchema = z
  .object({
    productId: z.string().regex(/^(?:[A-Za-z0-9_-]{12}|[0-9a-fA-F-]{36})$/, 'Invalid product ID'),
  })
  // Fail closed on injected fields (price, amount, discount). Only productId
  // is read; anything else is a tamper probe, not a client version skew.
  .strict()

export type Checkout = z.infer<typeof CheckoutSchema>
