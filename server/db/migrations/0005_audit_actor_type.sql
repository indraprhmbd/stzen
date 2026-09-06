-- Actor-type gating for audit_logs (admin / user / system).

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'user';

-- Backfill 1: actions only admins can perform.
UPDATE audit_logs SET actor_type = 'admin' WHERE action IN (
  'product:create', 'product:update', 'product:delete',
  'variant:create', 'variant:update', 'variant:delete',
  'settings:update', 'stock:import',
  'vault:unlock', 'vault:update', 'vault:delete', 'vault:revoke',
  'order:reject', 'order:deliver', 'order:refund', 'order:replace'
);

-- Backfill 2: webhook auto-approvals (no actor) are system.
UPDATE audit_logs SET actor_type = 'system'
WHERE action = 'order:approve' AND actor_id IS NULL;

-- Backfill 3: manual admin creates / approves via profiles role.
UPDATE audit_logs a SET actor_type = 'admin'
FROM profiles p
WHERE a.action IN ('order:create', 'order:approve')
  AND a.actor_id = p.id
  AND p.role = 'admin';

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time
  ON audit_logs (actor_type, created_at DESC);
