-- 0022: query-performance indexes + trigger search_path hardening + growth-cap GC
-- Non-destructive: CREATE INDEX IF NOT EXISTS + CREATE OR REPLACE FUNCTION + cron jobs.
-- Plain CREATE INDEX (small tables, free tier); CONCURRENTLY cannot run in the
-- migration transaction. Locks are momentary at current row counts.

-- ---------------------------------------------------------------------------
-- 1. Missing indexes (audit findings)
-- ---------------------------------------------------------------------------

-- Credential allocation: WHERE variant_id = $1 AND status = 'AVAILABLE'
-- ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED (0001).
CREATE INDEX IF NOT EXISTS vault_items_variant_status_created_idx
  ON vault_items (variant_id, status, created_at);

-- Low-stock counters: GROUP BY variant_id WHERE status = 'AVAILABLE'.
CREATE INDEX IF NOT EXISTS vault_items_available_variant_idx
  ON vault_items (variant_id) WHERE status = 'AVAILABLE';

-- reminder_preview RPC: filter (status, reminder_state), sort paid_at (0015).
CREATE INDEX IF NOT EXISTS orders_status_reminder_paid_idx
  ON orders (status, reminder_state, paid_at);

-- Overview/analytics cutoffs without status filter.
CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON orders (created_at);

-- Public catalog filters is_active = true, scoped per product (0011/0012/0013).
CREATE INDEX IF NOT EXISTS product_variants_is_active_idx
  ON product_variants (product_id) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 2. Trigger functions: pin search_path (linter function_search_path_mutable)
--    Bodies identical to 0019/0020 versions; only SET search_path added.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_badge_tags()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_variant_tags()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.cascade_product_tags()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.tags IS DISTINCT FROM OLD.tags THEN
    UPDATE product_variants
      SET tags_effective = NEW.tags
      WHERE product_id = NEW.id AND COALESCE(badge, '') = '';
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Growth caps: pg_cron GC jobs (500MB free-tier wall)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('purge_idempotency_claims')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_idempotency_claims');

SELECT cron.schedule(
  'purge_idempotency_claims',
  '17 3 * * *',
  $job$ DELETE FROM idempotency_claims WHERE created_at < now() - interval '7 days' $job$
);

SELECT cron.unschedule('audit_log_retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit_log_retention');

SELECT cron.schedule(
  'audit_log_retention',
  '37 3 * * *',
  $job$ DELETE FROM audit_logs WHERE created_at < now() - interval '90 days' $job$
);
