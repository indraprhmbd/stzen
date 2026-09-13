-- Data repair: variants whose stored duration contradicts their own name.
-- Detected by audit (name pattern "- N Bulan/Hari -" vs duration columns).
-- Garansi rows ("Garansi N hari") are warranty windows, not product
-- duration - duration_months stays NULL there so no expiry is scheduled.
-- Rewrites order snapshots for the affected variants so existing orders
-- follow the corrected terms, per ops decision.

UPDATE product_variants SET duration_months = 7,  duration_unit = 'day'   WHERE public_id = 'GyCrFJj6JsxP';
UPDATE product_variants SET duration_months = 7,  duration_unit = 'day'   WHERE public_id = 'T2_iWzV1rTSP';
UPDATE product_variants SET duration_months = 45, duration_unit = 'day'   WHERE public_id = 'AL0rkIqa-naP';
UPDATE product_variants SET duration_months = 2,  duration_unit = 'month' WHERE public_id = '9eNbhjFPIt8-';

UPDATE orders o
SET duration_snapshot = v.duration_months,
    duration_snapshot_unit = v.duration_unit
FROM product_variants v
WHERE (o.variant_id = v.id
       OR (o.variant_id IS NULL AND o.variant_sku_snapshot = v.sku AND o.product_id = v.product_id))
  AND v.public_id IN ('GyCrFJj6JsxP', 'T2_iWzV1rTSP', 'AL0rkIqa-naP', '9eNbhjFPIt8-');
