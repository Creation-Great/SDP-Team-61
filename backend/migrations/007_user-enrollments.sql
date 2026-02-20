-- Migration 007: User enrollment junction table for multi-course/group support
-- Up Migration
--
-- Problem:  users.course_id and users.group_id are single TEXT columns,
--           so a user can only belong to one course and one group.
-- Solution: user_enrollments junction table allows many (course, group) pairs
--           per user.  The "primary" enrollment is synced back to users.*
--           for full backward compatibility.

-- =============================================
-- Junction table
-- =============================================
CREATE TABLE IF NOT EXISTS user_enrollments (
  enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id     TEXT NOT NULL,
  group_id      TEXT,
  role          user_role NOT NULL DEFAULT 'student',
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each user appears at most once per course
CREATE UNIQUE INDEX IF NOT EXISTS ux_enrollment_user_course
  ON user_enrollments (user_id, course_id);

-- Fast lookup: all members of a course + group
CREATE INDEX IF NOT EXISTS ix_enrollment_course_group
  ON user_enrollments (course_id, group_id);

-- At most one primary enrollment per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS ux_enrollment_primary
  ON user_enrollments (user_id) WHERE is_primary = true;

-- =============================================
-- Seed from existing users.course_id / group_id
-- =============================================
INSERT INTO user_enrollments (user_id, course_id, group_id, role, is_primary)
SELECT user_id, course_id, group_id, role, true
FROM users
WHERE course_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================
-- Trigger: keep users.course_id/group_id in sync
-- with the row marked is_primary = true
-- =============================================
CREATE OR REPLACE FUNCTION sync_primary_enrollment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when a row becomes primary
  IF NEW.is_primary THEN
    -- Demote any other primary for this user
    UPDATE user_enrollments
    SET is_primary = false
    WHERE user_id = NEW.user_id
      AND enrollment_id != NEW.enrollment_id
      AND is_primary = true;

    -- Sync denormalized columns on users
    UPDATE users
    SET course_id = NEW.course_id,
        group_id  = NEW.group_id
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_primary_enrollment
AFTER INSERT OR UPDATE OF is_primary, course_id, group_id
ON user_enrollments
FOR EACH ROW
EXECUTE FUNCTION sync_primary_enrollment();

-- =============================================
-- Helper view: quick team roster per course
-- =============================================
CREATE OR REPLACE VIEW v_course_team_roster AS
SELECT ue.course_id,
       ue.group_id,
       ue.user_id,
       u.name,
       u.email,
       ue.role,
       ue.enrolled_at
FROM user_enrollments ue
JOIN users u ON u.user_id = ue.user_id
ORDER BY ue.course_id, ue.group_id, u.name;
