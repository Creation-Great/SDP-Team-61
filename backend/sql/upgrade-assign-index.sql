-- Upgrade: add composite index for reviewer pending lookups
CREATE INDEX IF NOT EXISTS idx_assign_reviewer_pending ON assignments(reviewer_id, status);
