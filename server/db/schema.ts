import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'

// ─── Enums ──────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['customer', 'admin'])

export const vaultStatusEnum = pgEnum('vault_status', [
  'AVAILABLE',
  'SOLD',
  'RESERVED',
  'REVOKED',
])

export const orderStatusEnum = pgEnum('order_status', [
  'PENDING',
  'PAID',
  'DELIVERED',
  'REFUNDED',
  'REJECTED',
])

export const durationUnitEnum = pgEnum('duration_unit', [
  'day',
  'week',
  'month',
])

// ─── Profiles ───────────────────────────────────────────────────────────────
// Extends Supabase auth.users - one row per authenticated user

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(), // refs auth.uid()
    email: text('email').notNull(),
    fullName: text('full_name'),
    role: userRoleEnum('role').notNull().default('customer'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('profiles_email_idx').on(table.email),
    index('profiles_role_idx').on(table.role),
  ]
)

// ─── Products ───────────────────────────────────────────────────────────────

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: text('public_id').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    overview: text('overview'),
    category: text('category').notNull(),
    price: integer('price').notNull(),
    badge: text('badge'),
    tags: text('tags').array().notNull().default([]),
    instructions: text('instructions'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('products_category_idx').on(table.category),
    index('products_is_active_idx').on(table.isActive),
    index('products_public_id_idx').on(table.publicId),
  ]
)

// ─── Product Variants ───────────────────────────────────────────────────────
// Purchasable SKU, variant behaves like product, 30+ rows, 5-6 parents
export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: text('public_id').notNull().unique(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    overview: text('overview'),
    description: text('description'),
    price: integer('price').notNull(),
    compareAtPrice: integer('compare_at_price'),
    badge: text('badge'),
    tags: text('tags').array().notNull().default([]),
    tagsEffective: text('tags_effective').array().notNull().default([]),
    durationMonths: integer('duration_months'),
    durationUnit: durationUnitEnum('duration_unit').notNull().default('month'),
    accountType: text('account_type'),
    conditions: text('conditions'),
    fulfillmentType: text('fulfillment_type').notNull().default('vault'),
    requiresDeliveryInfo: boolean('requires_delivery_info').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('product_variants_product_id_idx').on(table.productId),
    index('product_variants_public_id_idx').on(table.publicId),
    index('product_variants_sku_idx').on(table.sku),
    index('product_variants_fulfillment_type_idx').on(table.fulfillmentType),
  ]
)

// ─── Vault Items ────────────────────────────────────────────────────────────
// Encrypted credential payloads - AES-256-GCM at rest

export const vaultItems = pgTable(
  'vault_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    credentialPayload: text('credential_payload').notNull(), // AES-256-GCM encrypted
    status: vaultStatusEnum('status').notNull().default('AVAILABLE'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }),
  },
  (table) => [
    index('vault_items_product_id_idx').on(table.productId),
    index('vault_items_variant_id_idx').on(table.variantId),
    index('vault_items_status_idx').on(table.status),
  ]
)

// ─── Orders ─────────────────────────────────────────────────────────────────

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: text('public_id').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    vaultItemId: uuid('vault_item_id').references(() => vaultItems.id, {
      onDelete: 'set null',
    }),
    status: orderStatusEnum('status').notNull().default('PENDING'),
    paymentRef: text('payment_ref'),
    paymentProvider: text('payment_provider'),
    customerAccount: text('customer_account').notNull().default(''),
    waNumber: text('wa_number').notNull().default(''),
    amount: integer('amount').notNull(),
    // snapshots for immutable history
    variantNameSnapshot: text('variant_name_snapshot'),
    variantSkuSnapshot: text('variant_sku_snapshot'),
    priceAtPurchase: integer('price_at_purchase'),
    durationSnapshot: integer('duration_snapshot'),
    durationSnapshotUnit: text('duration_snapshot_unit'),
    accountTypeSnapshot: text('account_type_snapshot'),
    conditionsSnapshot: text('conditions_snapshot'),
    baseNameSnapshot: text('base_name_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [
    index('orders_user_id_idx').on(table.userId),
    index('orders_status_idx').on(table.status),
    index('orders_payment_ref_idx').on(table.paymentRef),
    index('orders_public_id_idx').on(table.publicId),
    index('orders_variant_id_idx').on(table.variantId),
    index('orders_payment_provider_idx').on(table.paymentProvider),
  ]
)
