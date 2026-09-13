-- Reminder toggle state (Pengingat table redesign). Mirrors Google truth:
// 'scheduled' iff an expiry event exists on an enabled channel.
// Written only by reminders.service (auto-hooks + manual toggles share
// one writer), so the column cannot drift from dispatch results.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reminder_state text NOT NULL DEFAULT 'none';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reminder_scheduled_at timestamptz NULL;

DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_reminder_state_check
    CHECK (reminder_state IN ('none', 'scheduled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS orders_reminder_state_idx
  ON orders (reminder_state);
