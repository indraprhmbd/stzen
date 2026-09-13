-- Low-stock aggregate RPCs. Replaces the 1+V per-variant count loop in
-- /admin/stats/low-stock: one GROUP BY over vault_items, threshold and limit
-- applied in SQL so the API never ships rows the client discards.
-- Follows the replace_order_credential convention: security definer,
-- fixed search_path, no RLS dependency (server calls as service_role).

CREATE OR REPLACE FUNCTION low_stock_variants(p_threshold int, p_limit int)
RETURNS TABLE (
  id text,
  name text,
  sku text,
  product_name text,
  stock_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stock AS (
    SELECT variant_id, COUNT(*) AS c
    FROM vault_items
    WHERE status = 'AVAILABLE'
    GROUP BY variant_id
  )
  SELECT
    v.public_id,
    v.name,
    v.sku,
    p.name,
    COALESCE(s.c, 0)
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
  LEFT JOIN stock s ON s.variant_id = v.id
  WHERE v.is_active
    AND v.fulfillment_type <> 'on_demand'
    AND COALESCE(s.c, 0) < p_threshold
  ORDER BY COALESCE(s.c, 0) ASC, v.name ASC
  LIMIT p_limit;
$$;

-- Global summary counters for the same threshold (out-of-stock vs running
-- low). Separate from the LIMITed rows above so the tiles stay exact.
CREATE OR REPLACE FUNCTION low_stock_summary(p_threshold int)
RETURNS TABLE (
  out_of_stock bigint,
  running_low bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stock AS (
    SELECT variant_id, COUNT(*) AS c
    FROM vault_items
    WHERE status = 'AVAILABLE'
    GROUP BY variant_id
  ),
  flagged AS (
    SELECT COALESCE(s.c, 0) AS c
    FROM product_variants v
    LEFT JOIN stock s ON s.variant_id = v.id
    WHERE v.is_active
      AND v.fulfillment_type <> 'on_demand'
      AND COALESCE(s.c, 0) < p_threshold
  )
  SELECT
    COUNT(*) FILTER (WHERE c = 0),
    COUNT(*) FILTER (WHERE c > 0)
  FROM flagged;
$$;
