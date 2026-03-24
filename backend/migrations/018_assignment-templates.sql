-- 018: assignment templates and submission linkage

CREATE TABLE IF NOT EXISTS assignment_templates (
  template_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  due_at        TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES users(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_templates_course
  ON assignment_templates(course_id, is_active, created_at DESC);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS assignment_template_id UUID REFERENCES assignment_templates(template_id);

CREATE INDEX IF NOT EXISTS idx_submissions_template
  ON submissions(assignment_template_id);
