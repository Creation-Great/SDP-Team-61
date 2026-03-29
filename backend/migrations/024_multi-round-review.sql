-- Multi-round revision support
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS revision_number INT NOT NULL DEFAULT 1;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS parent_submission_id UUID REFERENCES submissions(submission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_parent ON submissions(parent_submission_id);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_round INT NOT NULL DEFAULT 1;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS review_round INT NOT NULL DEFAULT 1;
