-- Audit compliance: review integrity hashes and data deletion requests
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_hash TEXT;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS review_hash TEXT;

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(user_id),
  status       TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  deleted_by   UUID REFERENCES users(user_id)
);
