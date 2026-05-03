-- Semesters, TA role, enhanced announcements
CREATE TABLE IF NOT EXISTS semesters (
  semester_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE peer_review_sessions ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(semester_id);
ALTER TABLE assignment_templates ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(semester_id);

-- Add TA role (idempotent)
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ta';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS announcements (
  announcement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       TEXT,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  link            TEXT DEFAULT '',
  is_pinned       BOOLEAN NOT NULL DEFAULT false,
  scheduled_at    TIMESTAMPTZ,
  attachment_url  TEXT,
  created_by      UUID NOT NULL REFERENCES users(user_id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_course ON announcements(course_id, created_at DESC);
