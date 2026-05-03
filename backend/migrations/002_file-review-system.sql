-- Migration 002: File review system (submissions, assignments, reviews, ML)
-- Up Migration

-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id),
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  filename      TEXT,
  file_url      TEXT,
  status        submission_status NOT NULL DEFAULT 'submitted',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);

-- Assignments (reviewer assignments)
CREATE TABLE IF NOT EXISTS assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(submission_id),
  reviewer_id   UUID NOT NULL REFERENCES users(user_id),
  status        assignment_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ux_assign_unique') THEN
    ALTER TABLE assignments ADD CONSTRAINT ux_assign_unique UNIQUE (submission_id, reviewer_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_assign_reviewer ON assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_assign_submission ON assignments(submission_id);
CREATE INDEX IF NOT EXISTS idx_assign_reviewer_pending ON assignments(reviewer_id, status);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  review_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(submission_id),
  reviewer_id   UUID NOT NULL REFERENCES users(user_id),
  score         NUMERIC CHECK (score >= 1 AND score <= 5),
  comments      TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_submission ON reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

-- ML Outputs (AI feedback integration)
CREATE TABLE IF NOT EXISTS ml_outputs (
  review_id      UUID PRIMARY KEY REFERENCES reviews(review_id) ON DELETE CASCADE,
  toxicity       DOUBLE PRECISION,
  politeness     DOUBLE PRECISION,
  sentiment      TEXT,
  identity_spans JSONB,
  evidence_spans JSONB,
  model_version  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rewrite Suggestions (AI-powered rewrite)
CREATE TABLE IF NOT EXISTS rewrite_suggestions (
  review_id     UUID PRIMARY KEY REFERENCES reviews(review_id) ON DELETE CASCADE,
  revised_text  TEXT,
  edits         JSONB,
  preserved     JSONB,
  reasoning     JSONB,
  model_version TEXT,
  adopted       BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
