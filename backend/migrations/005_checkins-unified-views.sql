-- Migration 005: Student check-ins and unified review views
-- Up Migration

-- Student Check-ins (instructor-managed evaluation data)
CREATE TABLE IF NOT EXISTS student_checkins (
  checkin_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES users(user_id),
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

-- Student Self Check-ins (student self-evaluation data)
CREATE TABLE IF NOT EXISTS student_self_checkins (
  self_checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES users(user_id),
  course_id       TEXT NOT NULL DEFAULT '',
  group_id        TEXT NOT NULL DEFAULT '',
  selected_member_id TEXT,
  weeks           JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id, group_id)
);

-- Unified Review Activity View
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

-- Per-student participation summary across both systems
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
