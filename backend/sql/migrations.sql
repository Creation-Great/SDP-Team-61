-- =====================================================
-- SDP-Team-61 Peer Review System — Full Rebuild Migration
-- Idempotent, safe to re-run
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Step A: Drop old objects (reverse FK order) ──────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_instructor_cohort CASCADE;
DROP VIEW IF EXISTS v_reviewer_todo CASCADE;
DROP VIEW IF EXISTS v_submission_counts CASCADE;
DROP TABLE IF EXISTS student_self_checkins CASCADE;
DROP TABLE IF EXISTS student_checkins CASCADE;
DROP TABLE IF EXISTS rewrite_suggestions CASCADE;
DROP TABLE IF EXISTS ml_outputs CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TYPE IF EXISTS submission_status CASCADE;
DROP TYPE IF EXISTS assignment_status CASCADE;

-- ─── Enums still needed ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student','instructor','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Step B: Users table (existing — modify columns) ──────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT 'cas-nologin',
  name          TEXT,
  role          user_role NOT NULL DEFAULT 'student',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users DROP COLUMN IF EXISTS course_id;
ALTER TABLE users DROP COLUMN IF EXISTS group_id;
ALTER TABLE users ADD COLUMN IF NOT EXISTS netid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_netid_unique ON users(netid) WHERE netid IS NOT NULL;
ALTER TABLE users ALTER COLUMN name DROP NOT NULL;

-- Audit table (keep it)
CREATE TABLE IF NOT EXISTS audit (
  event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor      UUID,
  action     TEXT,
  entity     TEXT,
  entity_id  UUID,
  meta_json  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Step C: New domain tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  course_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  name               TEXT NOT NULL,
  term               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_definitions (
  definition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by   UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS definition_students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES course_definitions(definition_id) ON DELETE CASCADE,
  team_key      TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  netid_guess   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS definition_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES course_definitions(definition_id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  sort_order    INT  NOT NULL
);

CREATE TABLE IF NOT EXISTS weeks (
  week_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id                UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  week_number              INT  NOT NULL,
  opens_at                 TIMESTAMPTZ NOT NULL,
  closes_at                TIMESTAMPTZ NOT NULL,
  scope_type               TEXT NOT NULL DEFAULT 'ALL' CHECK (scope_type IN ('ALL','TEAM')),
  scope_team_key           TEXT,
  definition_id_at_creation UUID REFERENCES course_definitions(definition_id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, week_number)
);

-- ─── week_teams junction table (new) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS week_teams (
  week_team_id SERIAL PRIMARY KEY,
  week_id      UUID NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  team_key     TEXT NOT NULL,
  UNIQUE(week_id, team_key)
);

CREATE TABLE IF NOT EXISTS week_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id     UUID NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  team_key    TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  netid_guess TEXT NOT NULL,
  user_id     UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS week_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id    UUID NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  sort_order INT  NOT NULL
);

CREATE TABLE IF NOT EXISTS review_assignments (
  assignment_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id                  UUID NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  reviewer_user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reviewee_week_student_id UUID NOT NULL REFERENCES week_students(id) ON DELETE CASCADE,
  status                   TEXT NOT NULL DEFAULT 'PENDING',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, reviewer_user_id, reviewee_week_student_id)
);

-- Update review_assignments status check to include CANCELLED
ALTER TABLE review_assignments DROP CONSTRAINT IF EXISTS review_assignments_status_check;
ALTER TABLE review_assignments ADD CONSTRAINT review_assignments_status_check
  CHECK (status IN ('PENDING','SUBMITTED','CANCELLED'));

CREATE TABLE IF NOT EXISTS review_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES review_assignments(assignment_id) ON DELETE CASCADE,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment_text  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS review_scores (
  score_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    UUID NOT NULL REFERENCES review_submissions(submission_id) ON DELETE CASCADE,
  week_category_id UUID NOT NULL REFERENCES week_categories(id) ON DELETE CASCADE,
  score_int        INT  NOT NULL CHECK (score_int BETWEEN 1 AND 5),
  UNIQUE (submission_id, week_category_id)
);

CREATE TABLE IF NOT EXISTS week_student_aggregates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id                  UUID NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  reviewee_week_student_id UUID NOT NULL REFERENCES week_students(id) ON DELETE CASCADE,
  avg_overall              NUMERIC(4,2),
  per_category_json        JSONB NOT NULL DEFAULT '{}',
  n_reviews                INT   NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, reviewee_week_student_id)
);

CREATE TABLE IF NOT EXISTS week_team_aggregates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id           UUID NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  team_key          TEXT NOT NULL,
  avg_overall       NUMERIC(4,2),
  per_category_json JSONB NOT NULL DEFAULT '{}',
  n_reviews         INT   NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, team_key)
);

CREATE TABLE IF NOT EXISTS course_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  team_key    TEXT,
  full_name   TEXT,
  netid_guess TEXT,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

-- ─── Step D: RLS on sensitive tables ──────────────────────────────────────────
ALTER TABLE review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_scores      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_ra ON review_assignments;
CREATE POLICY p_ra ON review_assignments USING (
  reviewer_user_id = COALESCE(
    current_setting('app.current_user_id', true),
    '00000000-0000-0000-0000-000000000000'
  )::uuid
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

DROP POLICY IF EXISTS p_rs ON review_submissions;
CREATE POLICY p_rs ON review_submissions USING (
  assignment_id IN (
    SELECT assignment_id FROM review_assignments
    WHERE reviewer_user_id = COALESCE(
      current_setting('app.current_user_id', true),
      '00000000-0000-0000-0000-000000000000'
    )::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

DROP POLICY IF EXISTS p_rscores ON review_scores;
CREATE POLICY p_rscores ON review_scores USING (
  submission_id IN (
    SELECT rs.submission_id
    FROM review_submissions rs
    JOIN review_assignments ra ON ra.assignment_id = rs.assignment_id
    WHERE ra.reviewer_user_id = COALESCE(
      current_setting('app.current_user_id', true),
      '00000000-0000-0000-0000-000000000000'
    )::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);
