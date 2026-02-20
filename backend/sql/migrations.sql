-- =====================================================
-- SDP-Team-61 Integrated Peer Review System
-- LEGACY Database Migration Script
--
-- NOTE: This file is DEPRECATED. Use versioned migrations instead:
--   npm run migrate       # run all pending migrations (up)
--   npm run migrate:down  # roll back the last migration
--
-- Versioned migration files are in: backend/migrations/
-- This file is kept for reference only.
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
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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
  submission_id UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
  reviewer_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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
  submission_id UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
  reviewer_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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

-- ----- submissions -----

-- SELECT: owner + assigned reviewer + instructor/admin
DROP POLICY IF EXISTS p_submissions_select ON submissions;
CREATE POLICY p_submissions_select ON submissions
FOR SELECT
USING (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.submission_id = submissions.submission_id
      AND a.reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
      AND a.status <> 'canceled'
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- INSERT: owner only
DROP POLICY IF EXISTS p_submissions_insert ON submissions;
CREATE POLICY p_submissions_insert ON submissions
FOR INSERT
WITH CHECK (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- UPDATE: owner only
DROP POLICY IF EXISTS p_submissions_update ON submissions;
CREATE POLICY p_submissions_update ON submissions
FOR UPDATE
USING (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
)
WITH CHECK (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- DELETE: owner + admin
DROP POLICY IF EXISTS p_submissions_delete ON submissions;
CREATE POLICY p_submissions_delete ON submissions
FOR DELETE
USING (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) = 'admin'
);

-- ----- assignments -----

-- SELECT: reviewer + submission owner + instructor/admin
DROP POLICY IF EXISTS p_assignments_select ON assignments;
CREATE POLICY p_assignments_select ON assignments
FOR SELECT
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (
    SELECT submission_id FROM submissions
    WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- INSERT: instructor/admin/student
DROP POLICY IF EXISTS p_assignments_insert ON assignments;
CREATE POLICY p_assignments_insert ON assignments
FOR INSERT
WITH CHECK (current_setting('app.current_role', true) IN ('instructor','admin','student'));

-- UPDATE: reviewer + instructor/admin
DROP POLICY IF EXISTS p_assignments_update ON assignments;
CREATE POLICY p_assignments_update ON assignments
FOR UPDATE
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- DELETE: admin only
DROP POLICY IF EXISTS p_assignments_delete ON assignments;
CREATE POLICY p_assignments_delete ON assignments
FOR DELETE
USING (current_setting('app.current_role', true) = 'admin');

-- ----- reviews -----

-- SELECT: reviewer + submission owner + instructor/admin
DROP POLICY IF EXISTS p_reviews_select ON reviews;
CREATE POLICY p_reviews_select ON reviews
FOR SELECT
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (
    SELECT submission_id FROM submissions
    WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- INSERT: reviewer only
DROP POLICY IF EXISTS p_reviews_insert ON reviews;
CREATE POLICY p_reviews_insert ON reviews
FOR INSERT
WITH CHECK (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- UPDATE: reviewer only
DROP POLICY IF EXISTS p_reviews_update ON reviews;
CREATE POLICY p_reviews_update ON reviews
FOR UPDATE
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
)
WITH CHECK (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- DELETE: reviewer + admin
DROP POLICY IF EXISTS p_reviews_delete ON reviews;
CREATE POLICY p_reviews_delete ON reviews
FOR DELETE
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) = 'admin'
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

-- =====================================================
-- Peer Review System (team-based peer evaluation)
-- =====================================================

-- peer_review_sessions: instructor creates a review session
CREATE TABLE IF NOT EXISTS peer_review_sessions (
  session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  created_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  course_id     TEXT,
  is_open       BOOLEAN NOT NULL DEFAULT true,
  deadline      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

-- peer_reviews: one row per reviewer-reviewee pair per session
CREATE TABLE IF NOT EXISTS peer_reviews (
  peer_review_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             UUID NOT NULL REFERENCES peer_review_sessions(session_id) ON DELETE CASCADE,
  reviewer_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reviewee_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_self                BOOLEAN NOT NULL DEFAULT false,
  technical_contributions INTEGER CHECK (technical_contributions BETWEEN 1 AND 5),
  team_interactions       INTEGER CHECK (team_interactions BETWEEN 1 AND 5),
  project_management      INTEGER CHECK (project_management BETWEEN 1 AND 5),
  individual_comments     TEXT DEFAULT '',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (session_id, reviewer_id, reviewee_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_reviews_session ON peer_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewer ON peer_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewee ON peer_reviews(reviewee_id);

-- team_chemistry: one row per reviewer per session
CREATE TABLE IF NOT EXISTS peer_review_team_chemistry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES peer_review_sessions(session_id) ON DELETE CASCADE,
  reviewer_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  score         INTEGER CHECK (score BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (session_id, reviewer_id)
);

-- v_peer_review_averages: auto-calculated averages per student per session
-- NOTE: team_chemistry is aggregated separately to avoid duplication.
CREATE OR REPLACE VIEW v_peer_review_averages AS
SELECT
  base.session_id,
  base.reviewee_id,
  base.student_name,
  base.team,
  base.avg_technical,
  base.avg_interactions,
  base.avg_management,
  tc_agg.avg_team_chemistry,
  base.review_count,
  base.self_review_count
FROM (
  SELECT
    pr.session_id,
    pr.reviewee_id,
    u.name          AS student_name,
    u.group_id      AS team,
    ROUND(AVG(pr.technical_contributions)::numeric, 2) AS avg_technical,
    ROUND(AVG(pr.team_interactions)::numeric, 2)       AS avg_interactions,
    ROUND(AVG(pr.project_management)::numeric, 2)      AS avg_management,
    COUNT(pr.peer_review_id)                            AS review_count,
    COUNT(pr.peer_review_id) FILTER (WHERE pr.is_self = true) AS self_review_count
  FROM peer_reviews pr
  JOIN users u ON u.user_id = pr.reviewee_id
  GROUP BY pr.session_id, pr.reviewee_id, u.name, u.group_id
) base
LEFT JOIN LATERAL (
  SELECT ROUND(AVG(tc.score)::numeric, 2) AS avg_team_chemistry
  FROM peer_review_team_chemistry tc
  JOIN users ru ON ru.user_id = tc.reviewer_id
  WHERE tc.session_id = base.session_id
    AND ru.group_id   = base.team
) tc_agg ON true;

-- =====================================================
-- Student Check-ins (instructor-managed evaluation data)
-- =====================================================
CREATE TABLE IF NOT EXISTS student_checkins (
  checkin_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id     TEXT NOT NULL DEFAULT '',
  group_id      TEXT NOT NULL DEFAULT '',
  file_name     TEXT,
  headers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics        JSONB NOT NULL DEFAULT '[]'::jsonb,
  members       JSONB NOT NULL DEFAULT '[]'::jsonb,
  weeks         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, course_id, group_id)
);

-- =====================================================
-- Student Self Check-ins (student self-evaluation data)
-- =====================================================
CREATE TABLE IF NOT EXISTS student_self_checkins (
  self_checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id       TEXT NOT NULL DEFAULT '',
  group_id        TEXT NOT NULL DEFAULT '',
  selected_member_id TEXT,
  weeks           JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id, group_id)
);

-- =====================================================
-- Unified Review Activity View
-- Normalises both review subsystems into a common shape
-- for cross-querying and instructor dashboards.
-- =====================================================
CREATE OR REPLACE VIEW v_unified_review_activity AS
-- File reviews
SELECT
  'file_review'::text             AS review_type,
  r.review_id                     AS review_id,
  s.submission_id                 AS context_id,
  s.title                         AS context_title,
  r.reviewer_id,
  rev_u.name                      AS reviewer_name,
  s.user_id                       AS reviewee_id,
  sub_u.name                      AS reviewee_name,
  r.score                         AS score,
  NULL::integer                   AS technical_contributions,
  NULL::integer                   AS team_interactions,
  NULL::integer                   AS project_management,
  r.comments,
  sub_u.course_id,
  sub_u.group_id,
  r.created_at
FROM reviews r
JOIN submissions s  ON s.submission_id = r.submission_id
JOIN users rev_u    ON rev_u.user_id   = r.reviewer_id
JOIN users sub_u    ON sub_u.user_id   = s.user_id

UNION ALL

-- Peer reviews
SELECT
  'peer_review'::text             AS review_type,
  pr.peer_review_id               AS review_id,
  pr.session_id                   AS context_id,
  ps.title                        AS context_title,
  pr.reviewer_id,
  rev_u.name                      AS reviewer_name,
  pr.reviewee_id,
  ree_u.name                      AS reviewee_name,
  ROUND((pr.technical_contributions + pr.team_interactions + pr.project_management)::numeric / 3, 2) AS score,
  pr.technical_contributions,
  pr.team_interactions,
  pr.project_management,
  pr.individual_comments          AS comments,
  ree_u.course_id,
  ree_u.group_id,
  pr.created_at
FROM peer_reviews pr
JOIN peer_review_sessions ps ON ps.session_id = pr.session_id
JOIN users rev_u             ON rev_u.user_id  = pr.reviewer_id
JOIN users ree_u             ON ree_u.user_id  = pr.reviewee_id;

-- =====================================================
-- Per-student participation summary across both systems
-- =====================================================
CREATE OR REPLACE VIEW v_student_review_participation AS
SELECT
  u.user_id,
  u.name,
  u.course_id,
  u.group_id,
  -- File review metrics
  COALESCE(fr_given.cnt, 0)       AS file_reviews_given,
  COALESCE(fr_recv.cnt, 0)        AS file_reviews_received,
  fr_recv.avg_score               AS avg_file_score_received,
  -- Peer review metrics
  COALESCE(pr_given.cnt, 0)       AS peer_reviews_given,
  COALESCE(pr_recv.cnt, 0)        AS peer_reviews_received,
  pr_recv.avg_score               AS avg_peer_score_received
FROM users u
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM reviews r WHERE r.reviewer_id = u.user_id
) fr_given ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt, ROUND(AVG(r.score)::numeric, 2) AS avg_score
  FROM reviews r
  JOIN submissions s ON s.submission_id = r.submission_id
  WHERE s.user_id = u.user_id
) fr_recv ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM peer_reviews pr WHERE pr.reviewer_id = u.user_id AND pr.is_self = false
) pr_given ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt,
         ROUND(AVG((pr.technical_contributions + pr.team_interactions + pr.project_management)::numeric / 3), 2) AS avg_score
  FROM peer_reviews pr WHERE pr.reviewee_id = u.user_id AND pr.is_self = false
) pr_recv ON true
WHERE u.role = 'student';

-- =====================================================
-- 007: User Enrollment Junction Table (multi-course/group)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_enrollments (
  enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id     TEXT NOT NULL,
  group_id      TEXT,
  role          user_role NOT NULL DEFAULT 'student',
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_enrollment_user_course
  ON user_enrollments (user_id, course_id);
CREATE INDEX IF NOT EXISTS ix_enrollment_course_group
  ON user_enrollments (course_id, group_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_enrollment_primary
  ON user_enrollments (user_id) WHERE is_primary = true;

-- Seed from existing data
INSERT INTO user_enrollments (user_id, course_id, group_id, role, is_primary)
SELECT user_id, course_id, group_id, role, true
FROM users
WHERE course_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Sync trigger
CREATE OR REPLACE FUNCTION sync_primary_enrollment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE user_enrollments
    SET is_primary = false
    WHERE user_id = NEW.user_id
      AND enrollment_id != NEW.enrollment_id
      AND is_primary = true;
    UPDATE users
    SET course_id = NEW.course_id,
        group_id  = NEW.group_id
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_primary_enrollment
AFTER INSERT OR UPDATE OF is_primary, course_id, group_id
ON user_enrollments
FOR EACH ROW
EXECUTE FUNCTION sync_primary_enrollment();

CREATE OR REPLACE VIEW v_course_team_roster AS
SELECT ue.course_id,
       ue.group_id,
       ue.user_id,
       u.name,
       u.email,
       ue.role,
       ue.enrolled_at
FROM user_enrollments ue
JOIN users u ON u.user_id = ue.user_id
ORDER BY ue.course_id, ue.group_id, u.name;
