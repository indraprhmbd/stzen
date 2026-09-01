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
])

export const orderStatusEnum = pgEnum('order_status', [
  'PENDING',
  'PAID',
  'DELIVERED',
  'REFUNDED',
  'REJECTED',
])

// ─── Profiles ───────────────────────────────────────────────────────────────
// Extends Supabase auth.users — one row per authenticated user

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(), // refs auth.uid()
    email: text('email').notNull(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
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
    category: text('category').notNull(),
    price: integer('price').notNull(),
    badge: text('badge'),
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

// ─── Vault Items ────────────────────────────────────────────────────────────
// Encrypted credential payloads — AES-256-GCM at rest

export const vaultItems = pgTable(
  'vault_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    credentialPayload: text('credential_payload').notNull(), // AES-256-GCM encrypted
    status: vaultStatusEnum('status').notNull().default('AVAILABLE'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    allocatedAt: timestamp('allocated_at', { withTimezone: true }),
  },
  (table) => [
    index('vault_items_product_id_idx').on(table.productId),
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
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    vaultItemId: uuid('vault_item_id').references(() => vaultItems.id, {
      onDelete: 'set null',
    }),
    status: orderStatusEnum('status').notNull().default('PENDING'),
    paymentRef: text('payment_ref'),
    amount: integer('amount').notNull(),
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
  ]
)
