-- Variant duration unit: day/week/month. Existing month-integer variants
-- backfilled to unit='month'. All SKUs regenerated from mockup data.

-- 1. New enum
CREATE TYPE duration_unit AS ENUM ('day', 'week', 'month');

-- 2. Variant column
ALTER TABLE product_variants
  ADD COLUMN duration_unit duration_unit NOT NULL DEFAULT 'month';

-- 3. Backfill explicit month for existing non-null durations
UPDATE product_variants SET duration_unit = 'month' WHERE duration_months IS NOT NULL;

-- 4. Orders snapshot (nullable, new orders only)
ALTER TABLE orders ADD COLUMN duration_snapshot_unit text;
