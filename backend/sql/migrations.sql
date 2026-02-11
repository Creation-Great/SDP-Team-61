-- =====================================================
-- SDP-Team-61 Integrated Peer Review System
-- Database Migration Script
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('pending','completed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student','instructor','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM ('submitted','reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- Users (enhanced: email/password auth instead of netid-only)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'student',
  course_id     TEXT,
  group_id      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Submissions (enhanced: file upload fields)
-- =====================================================
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

-- =====================================================
-- Assignments (reviewer assignments)
-- =====================================================
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

-- =====================================================
-- Reviews
-- =====================================================
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

-- =====================================================
-- ML Outputs (for AI feedback integration)
-- =====================================================
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

-- =====================================================
-- Rewrite Suggestions (AI-powered rewrite)
-- =====================================================
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

-- =====================================================
-- Audit Log
-- =====================================================
CREATE TABLE IF NOT EXISTS audit (
  event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor      UUID,
  action     TEXT,
  entity     TEXT,
  entity_id  UUID,
  meta_json  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Submissions: owner can read/write
DROP POLICY IF EXISTS p_submissions_owner ON submissions;
CREATE POLICY p_submissions_owner ON submissions
USING (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- Submissions: assigned reviewers can read
DROP POLICY IF EXISTS p_submissions_reviewer_read ON submissions;
CREATE POLICY p_submissions_reviewer_read ON submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.submission_id = submissions.submission_id
      AND a.reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
      AND a.status <> 'canceled'
  )
);

DROP POLICY IF EXISTS p_submissions_insert ON submissions;
CREATE POLICY p_submissions_insert ON submissions
FOR INSERT
WITH CHECK (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- Assignments: reviewer, submitter, or instructor can read
DROP POLICY IF EXISTS p_assignments_reader ON assignments;
CREATE POLICY p_assignments_reader ON assignments
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (
    SELECT submission_id FROM submissions
    WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

DROP POLICY IF EXISTS p_assignments_insert_instructor ON assignments;
CREATE POLICY p_assignments_insert_instructor ON assignments
FOR INSERT
WITH CHECK (current_setting('app.current_role', true) IN ('instructor','admin','student'));

DROP POLICY IF EXISTS p_assignments_update ON assignments;
CREATE POLICY p_assignments_update ON assignments
FOR UPDATE
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- Reviews: reviewer, submitter, or instructor can read
DROP POLICY IF EXISTS p_reviews_reader ON reviews;
CREATE POLICY p_reviews_reader ON reviews
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (
    SELECT submission_id FROM submissions
    WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

DROP POLICY IF EXISTS p_reviews_insert ON reviews;
CREATE POLICY p_reviews_insert ON reviews
FOR INSERT
WITH CHECK (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- =====================================================
-- Views
-- =====================================================
DROP VIEW IF EXISTS v_submission_counts;
CREATE VIEW v_submission_counts AS
SELECT s.submission_id,
       s.user_id,
       COUNT(a.assignment_id) FILTER (WHERE a.status <> 'canceled') AS assigned_count,
       COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed') AS completed_count
FROM submissions s
LEFT JOIN assignments a USING (submission_id)
GROUP BY s.submission_id, s.user_id;

DROP VIEW IF EXISTS v_reviewer_todo;
CREATE VIEW v_reviewer_todo AS
SELECT a.assignment_id, a.submission_id, a.reviewer_id, a.created_at
FROM assignments a
LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
WHERE a.status = 'pending' AND r.review_id IS NULL;

-- =====================================================
-- Materialized View for instructor dashboard
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS mv_instructor_cohort;
CREATE MATERIALIZED VIEW mv_instructor_cohort AS
SELECT u.course_id,
       u.group_id,
       date_trunc('week', COALESCE(a.created_at, s.created_at)) AS wk,
       COUNT(DISTINCT s.submission_id) AS submissions,
       COUNT(a.assignment_id) FILTER (WHERE a.status <> 'canceled') AS assignments,
       COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed') AS reviews_completed
FROM users u
JOIN submissions s ON s.user_id = u.user_id
LEFT JOIN assignments a ON a.submission_id = s.submission_id
GROUP BY 1,2,3;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'ux_mv_instructor_cohort' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX ux_mv_instructor_cohort ON mv_instructor_cohort (course_id, group_id, wk);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION refresh_mv_instructor_cohort()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_instructor_cohort;
END $$;
