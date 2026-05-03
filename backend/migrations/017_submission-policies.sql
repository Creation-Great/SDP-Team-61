-- 017: per-course submission edit/withdraw policies

CREATE TABLE IF NOT EXISTS submission_policies (
  policy_id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id                          TEXT NOT NULL UNIQUE,
  allow_edit_withdraw_after_reviews  BOOLEAN NOT NULL DEFAULT false,
  updated_by                         UUID REFERENCES users(user_id),
  updated_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
);
