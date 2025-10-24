CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Status enum for assignments
DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('pending','completed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Roles enum
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('student','instructor','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  user_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  netid        TEXT UNIQUE NOT NULL,
  role         role NOT NULL,
  course_id    TEXT NOT NULL,
  group_id     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id),
  title         TEXT,
  raw_uri       TEXT,
  masked_uri    TEXT,
  hash_raw      CHAR(64),
  hash_masked   CHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(submission_id),
  reviewer_id   UUID NOT NULL REFERENCES users(user_id),
  status        assignment_status NOT NULL DEFAULT 'pending',
  cost          NUMERIC,
  solver_version TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ux_assign_unique') THEN
    ALTER TABLE assignments ADD CONSTRAINT ux_assign_unique UNIQUE (submission_id, reviewer_id);
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_assign_reviewer ON assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_assign_submission ON assignments(submission_id);

CREATE TABLE IF NOT EXISTS reviews (
  review_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(submission_id),
  reviewer_id   UUID NOT NULL REFERENCES users(user_id),
  score         NUMERIC,
  raw_uri       TEXT,
  masked_uri    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_submission ON reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

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

CREATE TABLE IF NOT EXISTS rewrite_suggestions (
  review_id     UUID PRIMARY KEY REFERENCES reviews(review_id) ON DELETE CASCADE,
  revised_uri   TEXT,
  edits         JSONB,
  preserved     JSONB,
  why           JSONB,
  model_version TEXT,
  adopted       BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit (
  event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor      UUID,
  action     TEXT,
  entity     TEXT,
  entity_id  UUID,
  meta_json  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enable
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- READ policies
DROP POLICY IF EXISTS p_submissions_owner ON submissions;
CREATE POLICY p_submissions_owner ON submissions
USING (user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid);

DROP POLICY IF EXISTS p_assignments_reader ON assignments;
CREATE POLICY p_assignments_reader ON assignments
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (SELECT submission_id FROM submissions WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid)
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

DROP POLICY IF EXISTS p_reviews_reader ON reviews;
CREATE POLICY p_reviews_reader ON reviews
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (SELECT submission_id FROM submissions WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid)
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- WRITE policies (v1.3.1)
DROP POLICY IF EXISTS p_submissions_insert ON submissions;
CREATE POLICY p_submissions_insert ON submissions
FOR INSERT
WITH CHECK (user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid);

DROP POLICY IF EXISTS p_assignments_update_student ON assignments;
CREATE POLICY p_assignments_update_student ON assignments
FOR UPDATE
USING (reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid)
WITH CHECK (reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid);

DROP POLICY IF EXISTS p_assignments_insert_instructor ON assignments;
CREATE POLICY p_assignments_insert_instructor ON assignments
FOR INSERT
WITH CHECK (current_setting('app.current_role', true) IN ('instructor','admin'));

DROP POLICY IF EXISTS p_assignments_update_instructor ON assignments;
CREATE POLICY p_assignments_update_instructor ON assignments
FOR UPDATE
USING (current_setting('app.current_role', true) IN ('instructor','admin'))
WITH CHECK (current_setting('app.current_role', true) IN ('instructor','admin'));

DROP POLICY IF EXISTS p_reviews_insert ON reviews;
CREATE POLICY p_reviews_insert ON reviews
FOR INSERT
WITH CHECK (reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid);

-- MV for instructors
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'ux_mv_instructor_cohort' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX ux_mv_instructor_cohort ON mv_instructor_cohort (course_id, group_id, wk);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION refresh_mv_instructor_cohort()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_instructor_cohort;
END
$$;
