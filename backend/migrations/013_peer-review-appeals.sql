-- 013: peer review clarification / appeal requests

CREATE TABLE IF NOT EXISTS peer_review_appeals (
  appeal_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES peer_review_sessions(session_id),
  student_id        UUID NOT NULL REFERENCES users(user_id),
  target_type       TEXT NOT NULL DEFAULT 'session', -- session | review | comment
  target_id         TEXT,
  message           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open', -- open | resolved | rejected
  instructor_reply  TEXT DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peer_review_appeals_student ON peer_review_appeals(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_review_appeals_session ON peer_review_appeals(session_id, status, created_at DESC);
