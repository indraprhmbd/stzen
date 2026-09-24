-- 0032: pgcrypto is installed in the extensions schema on Supabase, but
-- checkout_cart pins search_path = public, so the unqualified
-- gen_random_bytes(9) call fails with "function does not exist".
-- Widen the function-local search_path instead of touching the body.

ALTER FUNCTION checkout_cart(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER)
  SET search_path = public, extensions;
