-- Drop unused avatar_url from profiles. The column was carried over from the
-- Supabase quickstart template and never read or written by any code path.
-- No data to preserve: the column only ever held NULLs.

ALTER TABLE profiles DROP COLUMN IF EXISTS avatar_url;
