-- Grade weight configuration
CREATE TABLE IF NOT EXISTS grade_weights (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id             TEXT NOT NULL UNIQUE,
  file_review_weight    NUMERIC(5,2) NOT NULL DEFAULT 40.0,
  peer_review_weight    NUMERIC(5,2) NOT NULL DEFAULT 40.0,
  checkin_weight        NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  drop_lowest           INT NOT NULL DEFAULT 0,
  drop_highest          INT NOT NULL DEFAULT 0,
  updated_by            UUID REFERENCES users(user_id),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
