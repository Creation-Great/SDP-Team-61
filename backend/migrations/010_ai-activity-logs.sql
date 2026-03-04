-- 010: AI Activity Logs & Notifications tables
-- ─────────────────────────────────────────────

-- AI activity log – records every polish / summarize call
CREATE TABLE IF NOT EXISTS ai_activity_logs (
    id          SERIAL PRIMARY KEY,
    action      VARCHAR(50)  NOT NULL,          -- 'polish' | 'summarize'
    user_id     VARCHAR(255),                   -- who triggered it (may be NULL for anonymous)
    detail      JSONB        DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_activity_logs (created_at DESC);

-- Notifications table – stores per-user notifications
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type        VARCHAR(50)  NOT NULL,          -- 'review_received' | 'review_assigned' | 'deadline' | 'ai_complete' | 'system'
    title       VARCHAR(255) NOT NULL,
    body        TEXT,
    link        VARCHAR(512),                   -- optional in-app link
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications (user_id, is_read, created_at DESC);
