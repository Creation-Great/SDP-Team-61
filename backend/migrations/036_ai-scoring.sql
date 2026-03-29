-- AI scoring assistant tables
CREATE TABLE IF NOT EXISTS ai_score_suggestions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
  rubric_id        UUID REFERENCES rubrics(rubric_id),
  suggested_min    NUMERIC(3,1),
  suggested_max    NUMERIC(3,1),
  reasoning        TEXT,
  model_version    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_calibration_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  submission_id    UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
  reviewer_score   NUMERIC(3,1),
  peer_avg_score   NUMERIC(3,1),
  deviation        NUMERIC(3,1),
  suggestion       TEXT,
  model_version    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
