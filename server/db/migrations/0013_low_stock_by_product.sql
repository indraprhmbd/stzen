-- Habis-variants per product (category label) for the Overview tile. Same
-- under-threshold set as low_stock_variants, aggregated so the tile shows a
-- per-product breakdown without duplicating the variant-level table rows.

CREATE OR REPLACE FUNCTION low_stock_by_product(p_threshold int)
RETURNS TABLE (
  product_name text,
  empty_count bigint
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
    p.name,
    COUNT(*) FILTER (WHERE COALESCE(s.c, 0) = 0)
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
  LEFT JOIN stock s ON s.variant_id = v.id
  WHERE v.is_active
    AND v.fulfillment_type <> 'on_demand'
    AND COALESCE(s.c, 0) < p_threshold
  GROUP BY p.name
  HAVING COUNT(*) FILTER (WHERE COALESCE(s.c, 0) = 0) > 0
  ORDER BY COUNT(*) FILTER (WHERE COALESCE(s.c, 0) = 0) DESC, p.name ASC;
$$;
