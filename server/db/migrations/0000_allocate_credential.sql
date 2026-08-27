-- Atomic credential allocation function
-- Uses FOR UPDATE SKIP LOCKED to prevent double-selling race conditions
-- Called by payment webhook handler after successful payment confirmation
--
-- Usage: SELECT * FROM allocate_credential(product_id, order_id)
-- Returns: the allocated vault_item row, or empty if none available

CREATE OR REPLACE FUNCTION allocate_credential(
  p_product_id UUID,
  p_order_id UUID
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
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
  -- Lock one available vault item for this product, skip locked rows
  -- This ensures concurrent checkouts don't double-sell the same credential
  SELECT vi.id, vi.product_id, vi.credential_payload, vi.status, vi.created_at
  INTO v_item
  FROM vault_items vi
  WHERE vi.product_id = p_product_id
    AND vi.status = 'AVAILABLE'
  ORDER BY vi.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no available item found, return empty
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Mark as SOLD and link to order
  UPDATE vault_items
  SET status = 'SOLD',
      allocated_at = NOW()
  WHERE id = v_item.id;

  -- Update order with vault item reference and mark as PAID
  UPDATE orders
  SET vault_item_id = v_item.id,
      status = 'PAID',
      paid_at = NOW()
  WHERE orders.id = p_order_id;

  -- Return the allocated item
  RETURN QUERY
  SELECT vi.id, vi.product_id, vi.credential_payload, vi.status, vi.created_at, vi.allocated_at
  FROM vault_items vi
  WHERE vi.id = v_item.id;
END;
$$;
