-- 0033: checkout_cart never populated legacy orders.product_id /
-- variant_id (NOT NULL, no default) - cart checkout died on insert.
-- Backfill both from the first order unit (position = 1) so legacy
-- readers (dashboard/admin single-line display) keep working.

CREATE OR REPLACE FUNCTION checkout_cart(
  p_cart_id UUID,
  p_user_id UUID,
  p_payment_provider TEXT,
  p_customer_account TEXT,
  p_wa_number TEXT,
  p_terms_consented_at TIMESTAMPTZ,
  p_expected_version INTEGER
)
RETURNS TABLE (
  order_id UUID,
  order_public_id TEXT,
  subtotal INTEGER,
  payment_fee INTEGER,
  payment_total INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_cart carts%ROWTYPE;
  v_item RECORD;
  v_variant RECORD;
  v_order orders%ROWTYPE;
  v_order_id UUID;
  v_public_id TEXT;
  v_subtotal INTEGER := 0;
  v_fee INTEGER := 0;
  v_total INTEGER;
  v_position INTEGER := 0;
  v_unit_offset INTEGER;
  v_order_unit_id UUID;
  v_vault_id UUID;
  v_item_count INTEGER;
  v_allow_backorder BOOLEAN;
BEGIN
  IF p_payment_provider NOT IN ('manual', 'sumopod') THEN
    RAISE EXCEPTION 'unsupported payment provider: %', p_payment_provider
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_cart
  FROM carts c
  WHERE c.id = p_cart_id
    AND c.user_id = p_user_id
    AND c.status = 'ACTIVE'
    AND c.expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cart not found or not owned by user'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_cart.version <> p_expected_version THEN
    RAISE EXCEPTION 'cart version conflict'
      USING ERRCODE = '40001';
  END IF;

  SELECT count(*) INTO v_item_count
  FROM cart_items ci
  WHERE ci.cart_id = p_cart_id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'cart is empty'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT ci.quantity
    FROM cart_items ci
    WHERE ci.cart_id = p_cart_id
    ORDER BY ci.id
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  v_public_id := rtrim(translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_'), '=');

  INSERT INTO orders (
    public_id, user_id, cart_id, amount, status, payment_provider,
    customer_account, wa_number, payment_status, fulfillment_status,
    subtotal, payment_fee, payment_total, terms_consented_at
  )
  VALUES (
    v_public_id, p_user_id, p_cart_id, 0, 'PENDING', p_payment_provider,
    COALESCE(p_customer_account, ''), COALESCE(p_wa_number, ''), 'PENDING', 'NOT_STARTED',
    0, 0, 0, p_terms_consented_at
  )
  RETURNING * INTO v_order;

  v_order_id := v_order.id;

  FOR v_item IN
    SELECT ci.quantity, ci.variant_id
    FROM cart_items ci
    WHERE ci.cart_id = p_cart_id
    ORDER BY ci.id
  LOOP
    SELECT pv.*
    INTO v_variant
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = v_item.variant_id
      AND pv.is_active = true
      AND p.is_active = true
      AND pv.fulfillment_type = 'vault'
    FOR SHARE OF pv, p;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'variant unavailable: %', v_item.variant_id
        USING ERRCODE = '22023';
    END IF;

    v_allow_backorder := v_variant.allow_backorder;
    v_subtotal := v_subtotal + (v_variant.price * v_item.quantity);

    FOR v_unit_offset IN 1..v_item.quantity LOOP
      v_position := v_position + 1;
      INSERT INTO order_units (
        order_id, variant_id, position, status,
        product_name_snapshot, variant_name_snapshot, variant_sku_snapshot,
        price_at_purchase, cost_at_purchase, profit_at_purchase,
        duration_snapshot, duration_snapshot_unit, account_type_snapshot,
        conditions_snapshot, base_name_snapshot, backorder_allowed,
        requires_delivery_info, created_at
      )
      SELECT
        v_order_id, pv.id, v_position, 'PENDING_PAYMENT',
        p.name, pv.name, pv.sku,
        pv.price, pv.cost_price,
        CASE WHEN pv.cost_price IS NULL THEN NULL ELSE pv.price - pv.cost_price END,
        pv.duration_months, pv.duration_unit::text, pv.account_type,
        pv.conditions, p.name, pv.allow_backorder,
        pv.requires_delivery_info, now()
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = v_item.variant_id
      RETURNING id INTO v_order_unit_id;

      INSERT INTO order_unit_delivery_info (order_unit_id, customer_account, wa_number)
      VALUES (v_order_unit_id, COALESCE(p_customer_account, ''), COALESCE(p_wa_number, ''));

      IF p_payment_provider = 'sumopod' THEN
        SELECT vi.id INTO v_vault_id
        FROM vault_items vi
        WHERE vi.variant_id = v_item.variant_id
          AND vi.status = 'AVAILABLE'
        ORDER BY vi.created_at, vi.id
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF FOUND THEN
          UPDATE vault_items
          SET status = 'RESERVED',
              reserved_order_unit_id = v_order_unit_id,
              reserved_at = now(),
              reservation_expires_at = now() + interval '24 hours'
          WHERE id = v_vault_id;

          UPDATE order_units
          SET status = 'RESERVED', vault_item_id = v_vault_id
          WHERE id = v_order_unit_id;
        ELSIF NOT v_allow_backorder THEN
          RAISE EXCEPTION 'variant out of stock: %', v_item.variant_id
            USING ERRCODE = 'P0001';
        ELSE
          UPDATE order_units
          SET status = 'AWAITING_STOCK'
          WHERE id = v_order_unit_id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  IF p_payment_provider = 'sumopod' AND v_subtotal < 10000 THEN
    RAISE EXCEPTION 'sumopod minimum is 10000 IDR'
      USING ERRCODE = '22023';
  END IF;

  v_fee := CASE
    WHEN p_payment_provider = 'sumopod' THEN ceil(v_subtotal * 0.007)::integer + 300
    ELSE 0
  END;
  v_total := v_subtotal + v_fee;

  UPDATE orders o
  SET amount = v_subtotal,
      subtotal = v_subtotal,
      payment_fee = v_fee,
      payment_total = v_total,
      -- Legacy single-line columns: first unit keeps old readers working.
      product_id = pv.product_id,
      variant_id = ou.variant_id
  FROM order_units ou
  JOIN product_variants pv ON pv.id = ou.variant_id
  WHERE o.id = v_order_id
    AND ou.order_id = v_order_id
    AND ou.position = 1;

  UPDATE carts
  SET status = 'CHECKOUT_PENDING',
      version = version + 1,
      updated_at = now()
  WHERE id = p_cart_id;

  RETURN QUERY SELECT v_order_id, v_public_id, v_subtotal, v_fee, v_total;
END;
$$;

REVOKE ALL ON FUNCTION checkout_cart(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION checkout_cart(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER)
  TO service_role;
