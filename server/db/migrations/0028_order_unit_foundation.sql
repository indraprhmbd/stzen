-- 0028: additive order-unit foundation for cart checkout.
-- One legacy order backfills one order unit. Existing order fields remain.

DO $$
BEGIN
  CREATE TYPE order_payment_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE order_fulfillment_status AS ENUM ('NOT_STARTED', 'PARTIAL', 'COMPLETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE order_unit_status AS ENUM (
    'PENDING_PAYMENT',
    'RESERVED',
    'AWAITING_STOCK',
    'AWAITING_CREDENTIAL',
    'DELIVERED',
    'REFUNDED',
    'REVOKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status order_payment_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS fulfillment_status order_fulfillment_status NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS subtotal integer,
  ADD COLUMN IF NOT EXISTS payment_fee integer,
  ADD COLUMN IF NOT EXISTS payment_total integer,
  ADD COLUMN IF NOT EXISTS checkout_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS terms_consented_at timestamptz;

UPDATE orders
SET payment_status = CASE
    WHEN status IN ('PAID', 'DELIVERED', 'REFUNDED') THEN 'PAID'::order_payment_status
    WHEN status = 'REJECTED' THEN 'REJECTED'::order_payment_status
    ELSE 'PENDING'::order_payment_status
  END,
  fulfillment_status = CASE
    WHEN status = 'DELIVERED' THEN 'COMPLETE'::order_fulfillment_status
    WHEN status = 'REFUNDED' THEN 'COMPLETE'::order_fulfillment_status
    ELSE 'NOT_STARTED'::order_fulfillment_status
  END,
  subtotal = COALESCE(subtotal, amount),
  payment_fee = COALESCE(payment_fee, 0),
  payment_total = COALESCE(payment_total, amount)
WHERE subtotal IS NULL;

CREATE TABLE IF NOT EXISTS order_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants (id) ON DELETE SET NULL,
  vault_item_id uuid REFERENCES vault_items (id) ON DELETE SET NULL,
  position integer NOT NULL,
  status order_unit_status NOT NULL DEFAULT 'PENDING_PAYMENT',
  product_name_snapshot text,
  variant_name_snapshot text,
  variant_sku_snapshot text,
  price_at_purchase integer,
  cost_at_purchase integer,
  profit_at_purchase integer,
  duration_snapshot integer,
  duration_snapshot_unit text,
  account_type_snapshot text,
  conditions_snapshot text,
  base_name_snapshot text,
  backorder_allowed boolean NOT NULL DEFAULT false,
  requires_delivery_info boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  refunded_amount integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS order_units_order_position_uq
  ON order_units (order_id, position);
CREATE INDEX IF NOT EXISTS order_units_order_idx ON order_units (order_id);
CREATE INDEX IF NOT EXISTS order_units_variant_idx ON order_units (variant_id);
CREATE INDEX IF NOT EXISTS order_units_vault_item_idx ON order_units (vault_item_id);
CREATE INDEX IF NOT EXISTS order_units_status_idx ON order_units (status);

CREATE TABLE IF NOT EXISTS order_unit_delivery_info (
  order_unit_id uuid PRIMARY KEY REFERENCES order_units (id) ON DELETE CASCADE,
  customer_account text NOT NULL DEFAULT '',
  wa_number text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS order_unit_delivery_info_unit_idx
  ON order_unit_delivery_info (order_unit_id);

INSERT INTO order_units (
  order_id, variant_id, vault_item_id, position, status,
  product_name_snapshot, variant_name_snapshot, variant_sku_snapshot,
  price_at_purchase, cost_at_purchase, profit_at_purchase,
  duration_snapshot, duration_snapshot_unit, account_type_snapshot,
  conditions_snapshot, base_name_snapshot, backorder_allowed,
  requires_delivery_info, delivered_at, refunded_amount, created_at
)
SELECT
  o.id, o.variant_id, o.vault_item_id, 0,
  CASE
    WHEN o.status = 'DELIVERED' THEN 'DELIVERED'::order_unit_status
    WHEN o.status = 'REFUNDED' THEN 'REFUNDED'::order_unit_status
    WHEN o.status = 'REJECTED' THEN 'REVOKED'::order_unit_status
    WHEN o.status = 'PENDING' THEN 'PENDING_PAYMENT'::order_unit_status
    WHEN COALESCE(pv.allow_backorder, false) AND o.vault_item_id IS NULL
      THEN 'AWAITING_STOCK'::order_unit_status
    ELSE 'AWAITING_CREDENTIAL'::order_unit_status
  END,
  o.base_name_snapshot,
  o.variant_name_snapshot,
  o.variant_sku_snapshot,
  o.price_at_purchase,
  o.cost_at_purchase,
  o.profit_at_purchase,
  o.duration_snapshot,
  o.duration_snapshot_unit,
  o.account_type_snapshot,
  o.conditions_snapshot,
  o.base_name_snapshot,
  o.backorder_allowed,
  COALESCE(pv.requires_delivery_info, false),
  CASE WHEN o.status IN ('DELIVERED', 'REFUNDED') THEN o.paid_at ELSE NULL END,
  o.refund_amount,
  o.created_at
FROM orders o
LEFT JOIN product_variants pv ON pv.id = o.variant_id
WHERE NOT EXISTS (SELECT 1 FROM order_units ou WHERE ou.order_id = o.id);

INSERT INTO order_unit_delivery_info (order_unit_id, customer_account, wa_number)
SELECT ou.id, o.customer_account, o.wa_number
FROM order_units ou
JOIN orders o ON o.id = ou.order_id
WHERE NOT EXISTS (
  SELECT 1 FROM order_unit_delivery_info di WHERE di.order_unit_id = ou.id
);

ALTER TABLE order_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_unit_delivery_info ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON order_units FROM anon, authenticated;
REVOKE ALL ON order_unit_delivery_info FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  provider text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  provider_payment_id text,
  provider_order_ref text,
  checkout_url text,
  requested_amount integer NOT NULL,
  expected_webhook_amount integer,
  status text NOT NULL DEFAULT 'CREATED',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_idempotency_uq
  ON payment_attempts (provider, idempotency_key);
CREATE INDEX IF NOT EXISTS payment_attempts_order_idx ON payment_attempts (order_id);
CREATE INDEX IF NOT EXISTS payment_attempts_provider_ref_idx
  ON payment_attempts (provider, provider_order_ref);
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_attempts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  payload_hash text,
  processing_status text NOT NULL DEFAULT 'RECEIVED',
  attempts integer NOT NULL DEFAULT 0,
  order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_uq
  ON webhook_events (provider, provider_event_id);
CREATE INDEX IF NOT EXISTS webhook_events_order_idx ON webhook_events (order_id);
CREATE INDEX IF NOT EXISTS webhook_events_status_idx ON webhook_events (processing_status);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON webhook_events FROM anon, authenticated;

ALTER TABLE vault_items
  ADD COLUMN IF NOT EXISTS reserved_order_unit_id uuid,
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS vault_items_reserved_unit_idx
  ON vault_items (reserved_order_unit_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vault_items_reserved_order_unit_fkey'
  ) THEN
    ALTER TABLE vault_items
      ADD CONSTRAINT vault_items_reserved_order_unit_fkey
      FOREIGN KEY (reserved_order_unit_id) REFERENCES order_units (id) ON DELETE SET NULL;
  END IF;
END $$;
