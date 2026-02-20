-- Migration 004: Peer review system (sessions, reviews, team chemistry)
-- Up Migration

-- peer_review_sessions: instructor creates a review session
CREATE TABLE IF NOT EXISTS peer_review_sessions (
  session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  created_by    UUID NOT NULL REFERENCES users(user_id),
  course_id     TEXT,
  is_open       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

-- peer_reviews: one row per reviewer-reviewee pair per session
CREATE TABLE IF NOT EXISTS peer_reviews (
  peer_review_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             UUID NOT NULL REFERENCES peer_review_sessions(session_id),
  reviewer_id            UUID NOT NULL REFERENCES users(user_id),
  reviewee_id            UUID NOT NULL REFERENCES users(user_id),
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
  session_id    UUID NOT NULL REFERENCES peer_review_sessions(session_id),
  reviewer_id   UUID NOT NULL REFERENCES users(user_id),
  score         INTEGER CHECK (score BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (session_id, reviewer_id)
);

-- v_peer_review_averages: auto-calculated averages per student per session
-- NOTE: team_chemistry is a per-reviewer (group-level) score, NOT per-reviewee.
-- We aggregate it separately to avoid inflating the average when a reviewer
-- has rated multiple reviewees.
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
  -- Deduplicated: one avg across all reviewers in this session who share
  -- the same group as the reviewee (team_chemistry is a group-level metric).
  SELECT ROUND(AVG(tc.score)::numeric, 2) AS avg_team_chemistry
  FROM peer_review_team_chemistry tc
  JOIN users ru ON ru.user_id = tc.reviewer_id
  WHERE tc.session_id = base.session_id
    AND ru.group_id   = base.team
) tc_agg ON true;
