-- Lock down profiles self-service. The client never reads or writes the
-- profiles table, so the UPDATE policy was pure attack surface: its
-- USING/WITH CHECK only pinned the row, not the columns, letting any user
-- rewrite their own role to 'admin'. Nothing authorized on profiles.role
-- today (app_metadata.role is the gate), but a future check would have been
-- an instant privesc. Default-deny: re-add UPDATE only when a shipped
-- feature needs it, scoped to that feature's columns.

DROP POLICY IF EXISTS profiles_update_own ON profiles;
