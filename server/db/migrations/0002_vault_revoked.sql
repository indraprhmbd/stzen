-- Vault revoked status for reported failed credentials.
-- Additive only. New rows start as AVAILABLE, allocation filters
-- status = 'AVAILABLE' everywhere, so REVOKED never reallocates.

ALTER TYPE vault_status ADD VALUE IF NOT EXISTS 'REVOKED';
