// Re-export all table schemas for Drizzle
// Single source of truth - modules import from shared/db/schema

export {
  profiles,
  products,
  productVariants,
  vaultItems,
  orders,
  userRoleEnum,
  vaultStatusEnum,
  orderStatusEnum,
  durationUnitEnum,
} from '../../db/schema'
