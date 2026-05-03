-- Anonymous review mechanism
DO $$ BEGIN
  CREATE TYPE anonymity_level AS ENUM ('none', 'single_blind', 'double_blind');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE peer_review_sessions ADD COLUMN IF NOT EXISTS anonymity anonymity_level NOT NULL DEFAULT 'none';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS anonymity anonymity_level NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS anonymous_reviewer_map (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID REFERENCES peer_review_sessions(session_id) ON DELETE CASCADE,
  submission_id  UUID REFERENCES submissions(submission_id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  anonymous_id   INT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id),
  UNIQUE(submission_id, user_id)
);
