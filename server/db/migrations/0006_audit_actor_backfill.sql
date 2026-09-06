-- Backfill actor_type for pre-existing rows.
-- Two blockers, both lifted only inside this window:
--   1. RULE audit_no_update rewrites every UPDATE to NOTHING (immutability).
--   2. RLS enabled with no policies blocks DML from migration roles.
-- Both are restored at the end. App code only INSERTs, so the rule stays
-- compatible going forward.

DROP RULE IF EXISTS audit_no_update ON audit_logs;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

UPDATE audit_logs SET actor_type = 'admin' WHERE action IN (
  'product:create', 'product:update', 'product:delete',
  'variant:create', 'variant:update', 'variant:delete',
  'settings:update', 'stock:import',
  'vault:unlock', 'vault:update', 'vault:delete', 'vault:revoke',
  'order:reject', 'order:deliver', 'order:refund', 'order:replace'
);

UPDATE audit_logs SET actor_type = 'system'
WHERE action = 'order:approve' AND actor_id IS NULL;

UPDATE audit_logs a SET actor_type = 'admin'
FROM profiles p
WHERE a.action IN ('order:create', 'order:approve')
  AND a.actor_id = p.id
  AND p.role = 'admin';

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE RULE audit_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;

-- Remove DML probe table from investigation.
DROP TABLE IF EXISTS _mig_probe;
