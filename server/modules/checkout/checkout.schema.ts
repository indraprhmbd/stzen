import { z } from 'zod'

// ─── Checkout Schema ────────────────────────────────────────────────────────

export const CheckoutSchema = z
  .object({
    productId: z.string().regex(/^(?:[A-Za-z0-9_-]{12}|[0-9a-fA-F-]{36})$/, 'Invalid product ID'),
    // Buyer-chosen rail. Validated against server availability in the
    // service (sumopod only when its API key is configured); unknown or
    // disabled methods fail closed. Stored on the order at create = lock.
    paymentMethod: z.enum(['manual', 'sumopod']),
    // Delivery contact. Required iff the variant's requires_delivery_info
    // flag is on (enforced in the service from the DB row, never the client
    // flag); ignored otherwise. WA is normalized server-side.
    customerAccount: z.string().max(120).optional(),
    waNumber: z.string().max(32).optional(),
  })
  // Fail closed on injected fields (price, amount, discount). Only productId
  // is read; anything else is a tamper probe, not a client version skew.
  .strict()

export type Checkout = z.infer<typeof CheckoutSchema>
