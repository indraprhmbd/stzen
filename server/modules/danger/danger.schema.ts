import { z } from 'zod'
import { DANGER } from './danger.types'

export const StalePreviewSchema = z.object({
  olderThanDays: z.coerce.number().int().min(DANGER.staleOrderDaysMin).max(DANGER.staleOrderDaysMax).optional().default(DANGER.staleOrderDaysDefault),
})

export type StalePreviewQuery = z.infer<typeof StalePreviewSchema>
