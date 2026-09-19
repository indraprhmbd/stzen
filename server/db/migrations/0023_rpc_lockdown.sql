-- 0023: lock down admin-only SECURITY DEFINER RPCs
-- Advisor finding: anon + authenticated could execute admin RPCs via
-- /rest/v1/rpc/* (stock levels = business intel, reminder_preview = all
-- customers' order data). Revoke from PUBLIC + roles, re-grant service_role
-- only (server runtime). Idempotent.

REVOKE EXECUTE ON FUNCTION public.low_stock_by_product(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.low_stock_summary(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.low_stock_variants(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.low_stock_variants(integer, integer, integer, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reminder_preview(text, text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.low_stock_by_product(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.low_stock_summary(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.low_stock_variants(integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.low_stock_variants(integer, integer, integer, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reminder_preview(text, text, text, text, integer, integer)
  TO service_role;
