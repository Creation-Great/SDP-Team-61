-- Deadline reminders, grace periods, and individual extensions
ALTER TABLE peer_review_sessions ADD COLUMN IF NOT EXISTS grace_period_hours INT NOT NULL DEFAULT 0;
ALTER TABLE assignment_templates ADD COLUMN IF NOT EXISTS grace_period_hours INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS deadline_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  reminder_hours  INT NOT NULL,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_entity ON deadline_reminders(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS deadline_extensions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  extended_to   TIMESTAMPTZ NOT NULL,
  reason        TEXT DEFAULT '',
  granted_by    UUID REFERENCES users(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);
