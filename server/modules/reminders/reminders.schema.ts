import { z } from 'zod'

export const BackfillSchema = z.object({
  limit: z.number().int().min(1).max(20).default(10),
})
