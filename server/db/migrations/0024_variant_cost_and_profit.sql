-- 0024: variant cost price + immutable order profit snapshots
-- Non-destructive: ADD COLUMN IF NOT EXISTS only. No backfill by design —
-- pre-feature PAID/DELIVERED orders keep NULL profit and contribute omzet only.
-- See docs/profit-tracking2026-09-21.md.

-- Harga beli / modal per variant. NULL = unknown cost, excluded from profit.
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cost_price integer;

-- Frozen at order creation from the live variant row.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cost_at_purchase integer;

-- Frozen at creation (amount - cost_at_purchase); recomputed while PENDING
-- when approve-manual edits amount; never touched once PAID. NULL when cost
-- unknown.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS profit_at_purchase integer;
