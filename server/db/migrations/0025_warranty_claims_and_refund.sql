-- Warranty claim log + stored refund result (spec docs/refund-calculator2026-09-21.md).
-- Claim counts come from this table, never from audit_logs (90d purge would
-- eat history). Server-only table: RLS on, zero policies (vault pattern).

CREATE TABLE IF NOT EXISTS warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  note text,
  actor_id text,
  actor_email text,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS warranty_claims_order_idx ON warranty_claims (order_id);

ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;

-- Applied refund result. NULL = never refunded. Pre-feature refunds were
-- always full, so overview falls back to amount when this is NULL.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount integer;
