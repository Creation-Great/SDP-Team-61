-- Rich text reviews and attachments
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS comments_html TEXT;
ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS individual_comments_html TEXT;

CREATE TABLE IF NOT EXISTS review_attachments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id      UUID REFERENCES reviews(review_id) ON DELETE CASCADE,
  peer_review_id UUID REFERENCES peer_reviews(peer_review_id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  file_url       TEXT NOT NULL,
  file_size      INT,
  mime_type      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (review_id IS NOT NULL OR peer_review_id IS NOT NULL)
);
