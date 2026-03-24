-- 014: notification channel preferences (in-app/email/push per type)

CREATE TABLE IF NOT EXISTS notification_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type          TEXT NOT NULL, -- review_received | review_assigned | deadline | ai_complete | system
  in_app        BOOLEAN NOT NULL DEFAULT true,
  email         BOOLEAN NOT NULL DEFAULT false,
  push          BOOLEAN NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON notification_preferences(user_id);
