import { z } from 'zod'

export const BulkSchema = z.object({
  ids: z.array(z.string().min(1).max(32)).min(1).max(20),
  action: z.enum(['schedule', 'cancel']),
})
