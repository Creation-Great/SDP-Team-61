-- Performance indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_sub_reviewer ON reviews(submission_id, reviewer_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_session_reviewer ON peer_reviews(session_id, reviewer_id);
