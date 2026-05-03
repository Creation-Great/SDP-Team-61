-- 016: backend draft store for file review and peer review forms

CREATE TABLE IF NOT EXISTS file_review_drafts (
  draft_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
  reviewer_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  score          INT,
  comments       TEXT NOT NULL DEFAULT '',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS peer_review_drafts (
  draft_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES peer_review_sessions(session_id) ON DELETE CASCADE,
  reviewer_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, reviewer_id)
);
