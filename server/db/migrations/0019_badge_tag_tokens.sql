-- Tag token arrays derived from badge text ('A;B' -> '{A,B}').
-- The storefront tag picker filters on these with the && overlap operator
-- (GIN-indexed) instead of leading-wildcard ILIKE on badge text.
-- badge stays the display source of truth; triggers keep tags in sync on
-- every write path (single admin forms + bulk imports) with zero app code.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION sync_badge_tags() RETURNS trigger AS $$
BEGIN
  NEW.tags := COALESCE(
    (SELECT array_agg(t ORDER BY t) FROM (
      SELECT DISTINCT upper(trim(x)) AS t
      FROM unnest(string_to_array(COALESCE(NEW.badge, ''), ';')) AS x
      WHERE trim(x) <> ''
    ) s),
    '{}'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_badge_tags ON products;
CREATE TRIGGER trg_products_badge_tags
  BEFORE INSERT OR UPDATE OF badge ON products
  FOR EACH ROW EXECUTE FUNCTION sync_badge_tags();

DROP TRIGGER IF EXISTS trg_variants_badge_tags ON product_variants;
CREATE TRIGGER trg_variants_badge_tags
  BEFORE INSERT OR UPDATE OF badge ON product_variants
  FOR EACH ROW EXECUTE FUNCTION sync_badge_tags();

-- Backfill existing rows through the trigger.
UPDATE products SET badge = badge;
UPDATE product_variants SET badge = badge;

CREATE INDEX IF NOT EXISTS idx_products_tags_gin ON products USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_variants_tags_gin ON product_variants USING gin (tags);
