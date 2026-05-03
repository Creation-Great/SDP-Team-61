-- 011: add optional course_id on submissions for explicit course scoping

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS course_id TEXT;

-- Backfill existing rows from author profile if missing
UPDATE submissions s
SET course_id = u.course_id
FROM users u
WHERE s.user_id = u.user_id
  AND s.course_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_course ON submissions(course_id);
