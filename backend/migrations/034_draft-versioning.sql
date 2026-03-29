-- Draft versioning for conflict detection
ALTER TABLE file_review_drafts ADD COLUMN IF NOT EXISTS draft_version INT NOT NULL DEFAULT 1;
ALTER TABLE file_review_drafts ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE peer_review_drafts ADD COLUMN IF NOT EXISTS draft_version INT NOT NULL DEFAULT 1;
ALTER TABLE peer_review_drafts ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now();
