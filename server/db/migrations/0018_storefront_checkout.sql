-- Storefront dual-flow checkout: per-variant delivery-info gating + per-order
-- buyer contact. requires_delivery_info defaults off (existing variants keep
-- the lean dialog). Order contact columns default '' (backfill-safe); the
-- server enforces required-ness from the variant flag at purchase time.

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS requires_delivery_info boolean NOT NULL DEFAULT false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_account text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wa_number text NOT NULL DEFAULT '';
