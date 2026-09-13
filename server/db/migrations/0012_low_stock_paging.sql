-- Paginated low-stock rows. Extends 0011: p_offset pages through the full
-- under-threshold set (the widget shows ALL of them, 5 per page), p_desc
-- flips the SISA sort so the operator can check the least-critical end too.
-- Defaults keep the 0011 call shape working (offset 0, ascending).

CREATE OR REPLACE FUNCTION low_stock_variants(
  p_threshold int,
  p_limit int,
  p_offset int DEFAULT 0,
  p_desc boolean DEFAULT false
)
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
  ORDER BY
    CASE WHEN p_desc THEN COALESCE(s.c, 0) END DESC,
    CASE WHEN NOT p_desc THEN COALESCE(s.c, 0) END ASC,
    v.name ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;
