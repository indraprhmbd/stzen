-- ─── rls-verify ─────────────────────────────────────────────────────────────
-- Manual verification for Supabase dashboard > SQL editor (run, not committed
-- to migrations: RLS policies live in dashboard, see audit doc).
-- Fails with EXCEPTION on first mismatch, prints NOTICE per check otherwise.
-- Expected posture (AGENTS.md):
--   profiles:               RLS on, authenticated SELECT/UPDATE own row
--   products,               RLS on, anon+authenticated SELECT active rows only
--   product_variants:
--   orders:                 RLS on, authenticated SELECT/INSERT own rows
--   vault_items,            RLS on, ZERO policies (server superuser only)
--   audit_logs:

DO $$
DECLARE
  t text;
  n integer;
BEGIN
  -- 1. RLS enabled on every app table
  FOR t IN SELECT unnest(ARRAY[
    'profiles', 'products', 'product_variants', 'orders',
    'vault_items', 'audit_logs'
  ]) LOOP
    SELECT count(*) INTO n FROM pg_tables
    WHERE schemaname = 'public' AND tablename = t AND rowsecurity = true;
    IF n = 0 THEN
      RAISE EXCEPTION '[rls-verify] RLS NOT enabled on %.', t;
    END IF;
    RAISE NOTICE '[rls-verify] RLS enabled on %.', t;
  END LOOP;

  -- 2. Server-only tables expose zero policies to anon/authenticated.
  -- idempotency_claims joined this list via advisor fix (RLS on, no policies).
  FOR t IN SELECT unnest(ARRAY['vault_items', 'audit_logs', 'settings', 'idempotency_claims']) LOOP
    SELECT count(*) INTO n FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t;
    IF n > 0 THEN
      RAISE EXCEPTION '[rls-verify] % has % policies, expected 0 (server only).', t, n;
    END IF;
    RAISE NOTICE '[rls-verify] % has no policies (server superuser only).', t;
  END LOOP;

  -- 3. Public catalog SELECT policies filter to active rows only
  -- (role may be anon, authenticated, or public depending on how the policy
  -- was created in dashboard, so match on the predicate, not the role list)
  FOR t IN SELECT unnest(ARRAY['products', 'product_variants']) LOOP
    SELECT count(*) INTO n FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t
      AND cmd = 'SELECT' AND qual ILIKE '%is_active%';
    IF n = 0 THEN
      RAISE EXCEPTION '[rls-verify] % missing SELECT policy scoped to is_active.', t;
    END IF;
    RAISE NOTICE '[rls-verify] % SELECT scoped to is_active.', t;
  END LOOP;

  -- 4. profiles + orders scoped to owner via auth.uid()
  FOR t IN SELECT unnest(ARRAY['profiles', 'orders']) LOOP
    SELECT count(*) INTO n FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t
      AND qual ILIKE '%auth.uid()%';
    IF n = 0 THEN
      RAISE EXCEPTION '[rls-verify] % missing auth.uid() owner policy.', t;
    END IF;
    RAISE NOTICE '[rls-verify] % has auth.uid() owner policy.', t;
  END LOOP;

  RAISE NOTICE '[rls-verify] ALL CHECKS PASSED.';
END $$;
