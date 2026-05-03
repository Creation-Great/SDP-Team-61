-- Migration 019: Add missing indexes for common query patterns
--
-- These indexes address performance bottlenecks identified in:
--   - Instructor dashboard course-filtered submission listings
--   - Peer review session result aggregations
--   - Rewrite suggestion adoption tracking
--   - Peer review session score lookups per student

-- Submissions filtered by course + ordered by date (instructor dashboard, AI search)
CREATE INDEX IF NOT EXISTS idx_submissions_course_created
  ON submissions (course_id, created_at DESC);

-- Peer reviews aggregated by session + reviewee (v_peer_review_averages, getSessionResults)
CREATE INDEX IF NOT EXISTS idx_peer_reviews_session_reviewee
  ON peer_reviews (session_id, reviewee_id);

-- Rewrite suggestion adoption tracking and analytics
CREATE INDEX IF NOT EXISTS idx_rewrite_adopted
  ON rewrite_suggestions (adopted, created_at DESC);

-- Peer review sessions filtered by course (getSessions queries)
CREATE INDEX IF NOT EXISTS idx_peer_review_sessions_course
  ON peer_review_sessions (course_id, created_at DESC);

-- Team chemistry lookups by session (getSessionResults)
CREATE INDEX IF NOT EXISTS idx_peer_review_team_chemistry_session
  ON peer_review_team_chemistry (session_id);
