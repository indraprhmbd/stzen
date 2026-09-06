-- Seed default rows for settings keys introduced after launch.
-- Without rows the admin form renders blanks and forces full re-entry.
-- ON CONFLICT DO NOTHING: never overwrites admin-configured values.

INSERT INTO settings (key, value, updated_at) VALUES
  ('store.name', '', now()),
  ('store.announcement', '', now()),
  ('ops.low_threshold', '5', now()),
  ('ops.vault_lock_minutes', '10', now()),
  ('ops.csv_limit', '1000', now())
ON CONFLICT (key) DO NOTHING;
