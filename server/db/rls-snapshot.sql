-- ─── rls-snapshot ───────────────────────────────────────────────────────────
-- Versioned capture of the LIVE RLS posture (verified 2026-09-19 via
-- pg_policies + anon-role probe). Policies normally live dashboard-only;
-- this file is the drift-proof reference for fresh projects / audits.
-- Re-runnable: each policy creation is guarded. NOT applied by db:migrate.
--
-- Posture (AGENTS.md):
--   products, product_variants : anon+authenticated SELECT is_active = true
--   orders                     : authenticated SELECT/INSERT own rows
--   profiles                   : authenticated SELECT own row (NO update;
--                                role is display-only, 0010 dropped UPDATE)
--   vault_items, audit_logs,
--   settings, idempotency_claims : RLS on, ZERO policies (superuser only)
--
-- Anon probe 2026-09-19: vault/audit/claims/settings/orders = 0 rows.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_claims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_public_read') THEN
    CREATE POLICY products_public_read ON products FOR SELECT
      TO anon, authenticated USING (is_active = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variants' AND policyname = 'variants_public_read') THEN
    CREATE POLICY variants_public_read ON product_variants FOR SELECT
      TO anon, authenticated USING (is_active = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_select_own') THEN
    CREATE POLICY orders_select_own ON orders FOR SELECT
      TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_insert_own') THEN
    CREATE POLICY orders_insert_own ON orders FOR INSERT
      TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON profiles FOR SELECT
      TO authenticated USING ((SELECT auth.uid()) = id);
  END IF;
END $$;

-- Deliberately NO policies for vault_items / audit_logs / settings /
-- idempotency_claims. Server reaches them as service_role (bypasses RLS).
-- Default-deny holds: any client-key access returns zero rows.

-- Admin-only SECURITY DEFINER RPCs are locked to service_role (0023):
--   low_stock_by_product, low_stock_summary, low_stock_variants (both
--   overloads), reminder_preview. allocate_credential / replace_order_credential
--   stay callable (checkout path, already revoked from PUBLIC in 0009).

-- Reminder: rotate + scope keys in Supabase Auth settings; enable leaked
-- password protection (dashboard toggle, not SQL).
