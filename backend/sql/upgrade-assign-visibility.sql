-- Upgrade: allow assigned reviewers to read corresponding submissions (read-only)
-- Safe to run multiple times.
DROP POLICY IF EXISTS p_submissions_assigned_reviewer_read ON submissions;
CREATE POLICY p_submissions_assigned_reviewer_read ON submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM assignments a
    WHERE a.submission_id = submissions.submission_id
      AND a.reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
      AND a.status <> 'canceled'
  )
);
