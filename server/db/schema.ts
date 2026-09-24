import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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

export const orderPaymentStatusEnum = pgEnum('order_payment_status', [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REJECTED',
])

export const orderFulfillmentStatusEnum = pgEnum('order_fulfillment_status', [
  'NOT_STARTED',
  'PARTIAL',
  'COMPLETE',
])

export const orderUnitStatusEnum = pgEnum('order_unit_status', [
  'PENDING_PAYMENT',
  'RESERVED',
  'AWAITING_STOCK',
  'AWAITING_CREDENTIAL',
  'DELIVERED',
  'REFUNDED',
  'REVOKED',
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
    // 0019: tag filter uses GIN overlap on the denormalized tokens array
    index('idx_products_tags_gin').using('gin', table.tags),
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
    // Harga beli / modal. NULL = unknown, excluded from profit.
    costPrice: integer('cost_price'),
    badge: text('badge'),
    tags: text('tags').array().notNull().default([]),
    tagsEffective: text('tags_effective').array().notNull().default([]),
    durationMonths: integer('duration_months'),
    durationUnit: durationUnitEnum('duration_unit').notNull().default('month'),
    accountType: text('account_type'),
    conditions: text('conditions'),
    fulfillmentType: text('fulfillment_type').notNull().default('vault'),
    // Backorder flag: vault variant stays buyable at zero stock; admin
    // fulfills from pool when restocked, else manual credential.
    allowBackorder: boolean('allow_backorder').notNull().default(false),
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
    // 0019/0020: tag tokens + effective (parent-inherited) GIN
    index('idx_variants_tags_gin').using('gin', table.tags),
    index('idx_variants_tags_effective_gin').using('gin', table.tagsEffective),
    // 0022: public catalog always filters is_active = true per product
    index('product_variants_is_active_idx')
      .on(table.productId)
      .where(sql`is_active = true`),
  ]
)

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    guestTokenHash: text('guest_token_hash'),
    status: text('status').notNull().default('ACTIVE'),
    version: integer('version').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('carts_user_active_uq')
      .on(table.userId)
      .where(sql`user_id is not null and status in ('ACTIVE', 'CHECKOUT_PENDING')`),
    uniqueIndex('carts_guest_active_uq')
      .on(table.guestTokenHash)
      .where(sql`guest_token_hash is not null and status in ('ACTIVE', 'CHECKOUT_PENDING')`),
    index('carts_expiry_idx').on(table.expiresAt),
    check('carts_owner_check', sql`num_nonnulls(user_id, guest_token_hash) = 1`),
    check(
      'carts_status_check',
      sql`status in ('ACTIVE', 'CHECKOUT_PENDING', 'CONVERTED', 'ABANDONED')`
    ),
  ]
)

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    unitPriceSnapshot: integer('unit_price_snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('cart_items_cart_variant_uq').on(table.cartId, table.variantId),
    index('cart_items_cart_idx').on(table.cartId),
    check('cart_items_quantity_check', sql`quantity > 0`),
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
    reservedOrderUnitId: uuid('reserved_order_unit_id'),
    reservedAt: timestamp('reserved_at', { withTimezone: true }),
    reservationExpiresAt: timestamp('reservation_expires_at', { withTimezone: true }),
  },
  (table) => [
    index('vault_items_product_id_idx').on(table.productId),
    index('vault_items_variant_id_idx').on(table.variantId),
    index('vault_items_status_idx').on(table.status),
    // 0022: allocation FOR UPDATE SKIP LOCKED (variant+status, FIFO by created_at)
    index('vault_items_variant_status_created_idx').on(
      table.variantId,
      table.status,
      table.createdAt
    ),
    // 0022: low-stock counters scan only AVAILABLE rows
    index('vault_items_available_variant_idx')
      .on(table.variantId)
      .where(sql`status = 'AVAILABLE'`),
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
    // Owning cart for atomic-checkout orders (0031). NULL for legacy
    // direct-checkout rows. Lets webhook failures restore the exact cart
    // instead of guessing the user's single CHECKOUT_PENDING row.
    cartId: uuid('cart_id').references(() => carts.id, { onDelete: 'set null' }),
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
    // Immutable profit pair: frozen at creation from the live variant row.
    // profit recomputed while PENDING on manual price edits; locked at PAID.
    costAtPurchase: integer('cost_at_purchase'),
    profitAtPurchase: integer('profit_at_purchase'),
    durationSnapshot: integer('duration_snapshot'),
    durationSnapshotUnit: text('duration_snapshot_unit'),
    accountTypeSnapshot: text('account_type_snapshot'),
    conditionsSnapshot: text('conditions_snapshot'),
    baseNameSnapshot: text('base_name_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    // Applied refund result (0025). NULL = never refunded / legacy full refund.
    refundAmount: integer('refund_amount'),
    // Frozen at checkout from product_variants.allow_backorder. Toggling
    // the variant later never retro-changes open orders.
    backorderAllowed: boolean('backorder_allowed').notNull().default(false),
    paymentStatus: orderPaymentStatusEnum('payment_status').notNull().default('PENDING'),
    fulfillmentStatus: orderFulfillmentStatusEnum('fulfillment_status')
      .notNull()
      .default('NOT_STARTED'),
    subtotal: integer('subtotal'),
    paymentFee: integer('payment_fee'),
    paymentTotal: integer('payment_total'),
    checkoutAttemptId: uuid('checkout_attempt_id'),
    termsConsentedAt: timestamp('terms_consented_at', { withTimezone: true }),
    // 0014: writer-owned mirror of Google Calendar reminder truth
    reminderState: text('reminder_state').notNull().default('none'),
  },
  (table) => [
    index('orders_user_id_idx').on(table.userId),
    index('orders_cart_id_idx').on(table.cartId),
    index('orders_status_idx').on(table.status),
    index('orders_payment_ref_idx').on(table.paymentRef),
    index('orders_public_id_idx').on(table.publicId),
    index('orders_variant_id_idx').on(table.variantId),
    index('orders_payment_provider_idx').on(table.paymentProvider),
    // FK lookups (joins from products/vault_items; 0022)
    index('orders_product_id_idx').on(table.productId),
    index('orders_vault_item_id_idx').on(table.vaultItemId),
    // 0022: dashboard/analytics + reminder_preview RPC patterns
    index('orders_status_created_idx').on(table.status, table.createdAt),
    index('orders_status_reminder_paid_idx').on(
      table.status,
      table.reminderState,
      table.paidAt
    ),
    index('orders_created_at_idx').on(table.createdAt),
  ]
)

export const orderUnits = pgTable(
  'order_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    vaultItemId: uuid('vault_item_id').references(() => vaultItems.id, { onDelete: 'set null' }),
    position: integer('position').notNull(),
    status: orderUnitStatusEnum('status').notNull().default('PENDING_PAYMENT'),
    productNameSnapshot: text('product_name_snapshot'),
    variantNameSnapshot: text('variant_name_snapshot'),
    variantSkuSnapshot: text('variant_sku_snapshot'),
    priceAtPurchase: integer('price_at_purchase'),
    costAtPurchase: integer('cost_at_purchase'),
    profitAtPurchase: integer('profit_at_purchase'),
    durationSnapshot: integer('duration_snapshot'),
    durationSnapshotUnit: text('duration_snapshot_unit'),
    accountTypeSnapshot: text('account_type_snapshot'),
    conditionsSnapshot: text('conditions_snapshot'),
    baseNameSnapshot: text('base_name_snapshot'),
    backorderAllowed: boolean('backorder_allowed').notNull().default(false),
    requiresDeliveryInfo: boolean('requires_delivery_info').notNull().default(false),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    refundedAmount: integer('refunded_amount'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('order_units_order_position_uq').on(table.orderId, table.position),
    index('order_units_order_idx').on(table.orderId),
    index('order_units_variant_idx').on(table.variantId),
    index('order_units_vault_item_idx').on(table.vaultItemId),
    index('order_units_status_idx').on(table.status),
  ]
)

export const orderUnitDeliveryInfo = pgTable(
  'order_unit_delivery_info',
  {
    orderUnitId: uuid('order_unit_id')
      .primaryKey()
      .references(() => orderUnits.id, { onDelete: 'cascade' }),
    customerAccount: text('customer_account').notNull().default(''),
    waNumber: text('wa_number').notNull().default(''),
  },
  (table) => [index('order_unit_delivery_info_unit_idx').on(table.orderUnitId)]
)

export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    providerPaymentId: text('provider_payment_id'),
    providerOrderRef: text('provider_order_ref'),
    checkoutUrl: text('checkout_url'),
    requestedAmount: integer('requested_amount').notNull(),
    expectedWebhookAmount: integer('expected_webhook_amount'),
    status: text('status').notNull().default('CREATED'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('payment_attempts_idempotency_uq').on(table.provider, table.idempotencyKey),
    index('payment_attempts_order_idx').on(table.orderId),
    index('payment_attempts_provider_ref_idx').on(table.provider, table.providerOrderRef),
  ]
)

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    payloadHash: text('payload_hash'),
    processingStatus: text('processing_status').notNull().default('RECEIVED'),
    attempts: integer('attempts').notNull().default(0),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('webhook_events_provider_event_uq').on(table.provider, table.providerEventId),
    index('webhook_events_order_idx').on(table.orderId),
    index('webhook_events_status_idx').on(table.processingStatus),
  ]
)

// ─── Warranty claims ────────────────────────────────────────────────────────
// Explicit per-order claim log (0025). Counts never derive from audit_logs
// (90d purge would eat history). Rotates (vault replace) write here too,
// plus a one-time backfill of historical order:replace audits (0026).
// Server-only: RLS on, zero policies.

export const warrantyClaims = pgTable(
  'warranty_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    note: text('note'),
    actorId: text('actor_id'),
    actorEmail: text('actor_email'),
    claimedAt: timestamp('claimed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('warranty_claims_order_idx').on(table.orderId)]
)

// ─── Operator notes ─────────────────────────────────────────────────────────
// Ticket-style annotations per order (Phase 3, 0027). Surfaced in Riwayat +
// count chip on row. Server-only: RLS on, zero policies.

export const orderNotes = pgTable(
  'order_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    actorId: text('actor_id'),
    actorEmail: text('actor_email'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('order_notes_order_idx').on(table.orderId)]
)
