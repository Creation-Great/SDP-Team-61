-- 012: configurable rubrics by scope

CREATE TABLE IF NOT EXISTS rubrics (
  rubric_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_type  TEXT NOT NULL, -- file_review | peer_technical | peer_interactions | peer_management
  course_id    TEXT,
  session_id   UUID,
  levels       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by   UUID REFERENCES users(user_id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubrics_lookup
  ON rubrics (rubric_type, course_id, session_id, updated_at DESC);
