-- 0035: link warranty claims to a specific order unit.
-- Unit warranty anchor (plan docs/order-unit-dashboards2026-09-24.md).
-- Nullable: legacy order-level claims keep order_unit_id NULL.
-- Server-only table posture unchanged: RLS on, zero policies.

ALTER TABLE warranty_claims
  ADD COLUMN IF NOT EXISTS order_unit_id uuid REFERENCES order_units (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS warranty_claims_order_unit_idx ON warranty_claims (order_unit_id);
