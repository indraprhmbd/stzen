-- Performance indexes for admin queries.
-- trigram GIN for audit_logs ILIKE search (leading-wildcard).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_audit_logs_search ON audit_logs
  USING GIN (
    (resource_public_id || ' ' || snapshot_text || ' ' || coalesce(actor_email, ''))
    gin_trgm_ops
  );
