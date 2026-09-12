import { z } from 'zod'
import { DANGER } from './danger.types'

export const StalePreviewSchema = z.object({
  olderThanDays: z.coerce.number().int().min(DANGER.staleOrderDaysMin).max(DANGER.staleOrderDaysMax).optional().default(DANGER.staleOrderDaysDefault),
})

export type StalePreviewQuery = z.infer<typeof StalePreviewSchema>

export const StaleRejectSchema = z.object({
  olderThanDays: z.number().int().min(DANGER.staleOrderDaysMin).max(DANGER.staleOrderDaysMax).default(DANGER.staleOrderDaysDefault),
  phrase: z.literal(DANGER.staleConfirmPhrase),
})

export const CatalogDeleteSchema = z.object({
  // Tier 2: phrase must equal the target's public_id (proves preview read).
  phrase: z.string().min(1),
})

export const ExportSchema = z.object({
  // Vault-only purge. The literal keeps the body shape stable while making
  // any order-purge attempt a 400.
  kind: z.literal('vault'),
})

export const PurgeSchema = z.object({
  exportToken: z.string().min(1),
  phrase: z.literal(DANGER.purgeConfirmPhrase),
})
