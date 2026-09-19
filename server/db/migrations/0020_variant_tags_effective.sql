-- Denormalized effective tag tokens on the variant (own tags, else parent
-- tags): lets the storefront filter with a single-column && overlap instead
-- of a cross-table or(), which PostgREST cannot parse.

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS tags_effective text[] NOT NULL DEFAULT '{}';

-- Variant trigger: own tokens from badge, else inherit parent tokens.
CREATE OR REPLACE FUNCTION sync_variant_tags() RETURNS trigger AS $$
DECLARE parent_tags text[] := '{}';
BEGIN
  NEW.tags := COALESCE(
    (SELECT array_agg(t ORDER BY t) FROM (
      SELECT DISTINCT upper(trim(x)) AS t
      FROM unnest(string_to_array(COALESCE(NEW.badge, ''), ';')) AS x
      WHERE trim(x) <> ''
    ) s),
    '{}'
  );
  IF NEW.tags = '{}' AND NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(p.tags, '{}') INTO parent_tags
    FROM products p WHERE p.id = NEW.product_id;
  END IF;
  NEW.tags_effective := CASE WHEN NEW.tags <> '{}' THEN NEW.tags ELSE parent_tags END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_variants_badge_tags ON product_variants;
DROP TRIGGER IF EXISTS trg_variant_tags ON product_variants;
CREATE TRIGGER trg_variant_tags
  BEFORE INSERT OR UPDATE OF badge, product_id ON product_variants
  FOR EACH ROW EXECUTE FUNCTION sync_variant_tags();

-- Parent cascade: a basis badge edit refreshes only follow-parent children
-- (empty own badge). Custom-badge variants keep their own tokens.
CREATE OR REPLACE FUNCTION cascade_product_tags() RETURNS trigger AS $$
BEGIN
  IF NEW.tags IS DISTINCT FROM OLD.tags THEN
    UPDATE product_variants
      SET tags_effective = NEW.tags
      WHERE product_id = NEW.id AND COALESCE(badge, '') = '';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_tags_cascade ON products;
CREATE TRIGGER trg_products_tags_cascade
  AFTER UPDATE OF badge ON products
  FOR EACH ROW EXECUTE FUNCTION cascade_product_tags();

-- Backfill through the trigger (parent tags already exist from 0019).
UPDATE product_variants SET badge = badge;

CREATE INDEX IF NOT EXISTS idx_variants_tags_effective_gin ON product_variants USING gin (tags_effective);
