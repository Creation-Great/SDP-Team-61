-- Assignment strategy and exclusion rules
DO $$ BEGIN
  CREATE TYPE assignment_strategy AS ENUM ('random', 'load_balanced', 'reciprocal', 'manual_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS assignment_strategy assignment_strategy NOT NULL DEFAULT 'random';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS min_reviews_required INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS review_exclusions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   TEXT NOT NULL,
  user_a      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  user_b      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reason      TEXT DEFAULT '',
  created_by  UUID REFERENCES users(user_id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, user_a, user_b)
);
