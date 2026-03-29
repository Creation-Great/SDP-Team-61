-- Review quality assessment tables
CREATE TABLE IF NOT EXISTS review_helpfulness (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
  voter_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_helpful  BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, voter_id)
);

CREATE TABLE IF NOT EXISTS reviewer_reputation (
  user_id              UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  helpfulness_score    NUMERIC(3,2) DEFAULT 0,
  consistency_score    NUMERIC(3,2) DEFAULT 0,
  total_reviews        INT DEFAULT 0,
  helpful_votes        INT DEFAULT 0,
  total_votes          INT DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_depth_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id        UUID NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE UNIQUE,
  constructiveness NUMERIC(3,2),
  specificity      NUMERIC(3,2),
  actionability    NUMERIC(3,2),
  model_version    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
