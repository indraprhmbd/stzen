-- Atomic idempotency claims for checkout and webhooks.
-- Insert-first pattern: winner processes, unique violation (23505) means
-- duplicate. Separate narrow table keeps audit_logs history clean (no claim
-- rows polluting the action enum). NULL never occurs: key is PRIMARY KEY.

CREATE TABLE IF NOT EXISTS idempotency_claims (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
