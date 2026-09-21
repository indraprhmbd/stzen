-- One-time backfill: historical credential rotates (audit order:replace)
-- become warranty_claims rows so counts have a single source going forward
-- (spec docs/refund-calculator2026-09-21.md). Idempotent: skips orders that
-- already have a rotate-sourced row.

INSERT INTO warranty_claims (order_id, note, actor_id, actor_email, claimed_at)
SELECT o.id,
  'Rotasi kredensial (backfill order:replace)',
  a.actor_id,
  a.actor_email,
  a.created_at
FROM audit_logs a
JOIN orders o ON o.public_id = a.resource_public_id
WHERE a.action = 'order:replace'
  AND NOT EXISTS (
    SELECT 1 FROM warranty_claims w
    WHERE w.order_id = o.id AND w.note LIKE 'Rotasi kredensial%'
  );
