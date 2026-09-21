-- Operator notes per order (spec docs/orders-overhaul2026-09-21.md Phase 3).
-- Ticket-style annotations: handover context, buyer promises, follow-ups.
-- Server-only table: RLS on, zero policies (warranty_claims pattern).

CREATE TABLE IF NOT EXISTS order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  note text NOT NULL,
  actor_id text,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_notes_order_idx ON order_notes (order_id);

ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;
