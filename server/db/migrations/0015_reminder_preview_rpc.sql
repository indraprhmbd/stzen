-- Stateful reminder preview with exact expiry ordering. Expiry is
-- paid_at + duration (mixed day/week/month units), which PostgREST cannot
-- ORDER BY, so this RPC sorts with a CASE expression server-side and
-- returns the page plus total in one round trip.

CREATE OR REPLACE FUNCTION reminder_preview(
  p_state text,
  p_q text,
  p_sort text,
  p_dir text,
  p_limit int,
  p_offset int
)
RETURNS TABLE (
  public_id text,
  product_name text,
  status text,
  paid_at timestamptz,
  amount integer,
  variant_id uuid,
  duration_snapshot integer,
  duration_snapshot_unit text,
  reminder_state text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      o.public_id,
      COALESCE(o.variant_name_snapshot, o.base_name_snapshot, 'Produk') AS product_name,
      o.status,
      o.paid_at,
      o.amount,
      o.variant_id,
      o.duration_snapshot,
      o.duration_snapshot_unit,
      o.reminder_state,
      o.paid_at + CASE o.duration_snapshot_unit
        WHEN 'day' THEN (COALESCE(o.duration_snapshot, 0) || ' days')::interval
        WHEN 'week' THEN ((COALESCE(o.duration_snapshot, 0) * 7) || ' days')::interval
        WHEN 'month' THEN (COALESCE(o.duration_snapshot, 0) || ' months')::interval
        ELSE interval '0'
      END AS expiry
    FROM orders o
    WHERE o.status IN ('PAID', 'DELIVERED')
      AND (p_state = 'all' OR o.reminder_state = p_state)
      AND (
        p_q = '' OR
        o.public_id ILIKE '%' || p_q || '%' OR
        COALESCE(o.variant_name_snapshot, '') ILIKE '%' || p_q || '%' OR
        COALESCE(o.base_name_snapshot, '') ILIKE '%' || p_q || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS total_count FROM base
  )
  SELECT
    b.public_id, b.product_name, b.status, b.paid_at, b.amount,
    b.variant_id, b.duration_snapshot, b.duration_snapshot_unit,
    b.reminder_state, c.total_count
  FROM base b CROSS JOIN counted c
  ORDER BY
    CASE WHEN p_sort = 'product' AND p_dir = 'asc' THEN b.product_name END ASC,
    CASE WHEN p_sort = 'product' AND p_dir = 'desc' THEN b.product_name END DESC,
    CASE WHEN p_sort = 'paidAt' AND p_dir = 'asc' THEN b.paid_at END ASC,
    CASE WHEN p_sort = 'paidAt' AND p_dir = 'desc' THEN b.paid_at END DESC,
    CASE WHEN p_sort = 'expiry' AND p_dir = 'asc' THEN b.expiry END ASC NULLS LAST,
    CASE WHEN p_sort = 'expiry' AND p_dir = 'desc' THEN b.expiry END DESC NULLS LAST,
    b.paid_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
