-- Payment Gateway Scaffold — schema + RPC updates
-- Applied to production via Supabase migration `payments_scaffold`
-- (2026-09-03) plus a follow-up `allocate_credential_set_search_path` fix
-- for the function-search-path-mutable advisory. This file is kept as the
-- readable reference copy — this project syncs schema via `npm run db:push`
-- (Drizzle) day-to-day, not `drizzle-kit migrate`.
--
-- 1. orders.payment_provider — records which gateway (manual/duitku/sumopod)
--    was used to initiate payment. Nullable: existing rows predate gateways.
-- 2. allocate_credential — rewritten to be variant-aware. The original
--    (see 0000_allocate_credential.sql) allocated by product_id and jumped
--    the order straight to PAID. Stock is now tracked per variant
--    (vault_items.variant_id), and order status transitions must go through
--    the app's state machine (server/modules/orders/orders.types.ts), so this
--    version ONLY locks + allocates a credential and links it to the order.
--    It does not touch orders.status — callers (payments.service.ts) drive
--    PENDING -> PAID -> DELIVERED explicitly.

-- ─── 1. orders.payment_provider ─────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;

CREATE INDEX IF NOT EXISTS orders_payment_provider_idx ON orders USING btree (payment_provider);

-- ─── 2. allocate_credential (variant-aware) ─────────────────────────────────
-- Same 2-arg signature as the original function so CREATE OR REPLACE swaps it
-- in place. First argument is now a variant id, not a product id.
--
-- Usage: SELECT * FROM allocate_credential(variant_id, order_id)
-- Returns: the allocated vault_item row, or empty if none available

-- SET search_path pins the function against search_path hijacking (Supabase
-- linter: function_search_path_mutable).
CREATE OR REPLACE FUNCTION allocate_credential(
  p_variant_id UUID,
  p_order_id UUID
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  variant_id UUID,
  credential_payload TEXT,
  status vault_status,
  created_at TIMESTAMPTZ,
  allocated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Lock one available vault item for this variant, skip locked rows.
  -- This ensures concurrent checkouts/webhooks don't double-sell the same credential.
  SELECT vi.id, vi.product_id, vi.variant_id, vi.credential_payload, vi.status, vi.created_at
  INTO v_item
  FROM vault_items vi
  WHERE vi.variant_id = p_variant_id
    AND vi.status = 'AVAILABLE'
  ORDER BY vi.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no available item found, return empty. Caller keeps the order at PAID
  -- and leaves fulfillment to manual admin action.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Mark as SOLD and link to order. Status transition (PAID -> DELIVERED) is
  -- the caller's responsibility, not this function's.
  UPDATE vault_items
  SET status = 'SOLD',
      allocated_at = NOW()
  WHERE vault_items.id = v_item.id;

  UPDATE orders
  SET vault_item_id = v_item.id
  WHERE orders.id = p_order_id;

  RETURN QUERY
  SELECT vi.id, vi.product_id, vi.variant_id, vi.credential_payload, vi.status, vi.created_at, vi.allocated_at
  FROM vault_items vi
  WHERE vi.id = v_item.id;
END;
$$;

ALTER FUNCTION allocate_credential(uuid, uuid) SET search_path = public;
