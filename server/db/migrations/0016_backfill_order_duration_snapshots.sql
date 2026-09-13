-- Backfill order duration snapshots from the live variant. Two gap classes:
-- 1. Legacy orders created before duration_snapshot(_unit) existed.
-- 2. Manual admin orders whose snapshot wrote camelCase keys that
--    orders.create never read (duration_snapshot stayed NULL).
-- Snapshot remains the source of truth after purchase; this only repairs
-- rows written before the invariant held. Orders without variant_id (bare
-- products, no duration concept) are intentionally left NULL.

UPDATE orders o
SET duration_snapshot = v.duration_months,
    duration_snapshot_unit = v.duration_unit
FROM product_variants v
WHERE o.variant_id = v.id
  AND v.duration_months IS NOT NULL
  AND v.duration_unit IS NOT NULL
  AND (o.duration_snapshot IS NULL OR o.duration_snapshot_unit IS NULL);
