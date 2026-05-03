-- Migration 009: Tighten RLS policies — split overly broad ALL policies
--                into per-command (SELECT / INSERT / UPDATE / DELETE) policies.
-- Up Migration
--
-- Problem:  p_submissions_owner, p_assignments_reader, and p_reviews_reader
--           use USING without FOR <command>, which means their conditions
--           apply to SELECT *and* UPDATE/DELETE.  An instructor could thus
--           UPDATE or DELETE any student submission, assignment, or review.
--
-- Fix:      Replace each broad ALL policy with fine-grained per-command
--           policies following least-privilege:
--
--   submissions:
--     SELECT  → owner + assigned reviewer + instructor/admin
--     INSERT  → owner only (already exists — kept)
--     UPDATE  → owner only (student edits own submission)
--     DELETE  → owner + admin only
--
--   assignments:
--     SELECT  → reviewer + submission owner + instructor/admin
--     INSERT  → instructor/admin/student (auto-assign) — kept
--     UPDATE  → reviewer (mark complete) + instructor/admin (manage)
--     DELETE  → admin only
--
--   reviews:
--     SELECT  → reviewer + submission owner + instructor/admin
--     INSERT  → reviewer only (already exists — kept)
--     UPDATE  → reviewer only
--     DELETE  → reviewer + admin only

BEGIN;

-- Helper: reusable expression for the current session user_id
-- (app.current_user_id is SET by the withDb wrapper)
-- Using a variable shorthand for readability in comments;
-- in actual SQL we inline the COALESCE expression.

-- =====================================================
-- SUBMISSIONS
-- =====================================================

-- Drop the old broad ALL policy
DROP POLICY IF EXISTS p_submissions_owner ON submissions;
DROP POLICY IF EXISTS p_submissions_select ON submissions;

-- (a) SELECT: owner, assigned reviewer (already has own policy), instructor/admin
CREATE POLICY p_submissions_select ON submissions
FOR SELECT
USING (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);
-- NOTE: p_submissions_reviewer_read already covers assigned reviewers for SELECT.

-- (b) INSERT: owner only (already exists, re-create for clarity)
DROP POLICY IF EXISTS p_submissions_insert ON submissions;
CREATE POLICY p_submissions_insert ON submissions
FOR INSERT
WITH CHECK (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- (c) UPDATE: owner only (student edits own submission title/description)
DROP POLICY IF EXISTS p_submissions_update ON submissions;
CREATE POLICY p_submissions_update ON submissions
FOR UPDATE
USING (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
)
WITH CHECK (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- (d) DELETE: owner + admin only (instructor cannot delete student work)
DROP POLICY IF EXISTS p_submissions_delete ON submissions;
CREATE POLICY p_submissions_delete ON submissions
FOR DELETE
USING (
  user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) = 'admin'
);

-- =====================================================
-- ASSIGNMENTS
-- =====================================================

-- Drop the old broad ALL policy used for reading
DROP POLICY IF EXISTS p_assignments_reader ON assignments;
DROP POLICY IF EXISTS p_assignments_select ON assignments;

-- (a) SELECT: reviewer, submission owner, instructor/admin
CREATE POLICY p_assignments_select ON assignments
FOR SELECT
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (
    SELECT submission_id FROM submissions
    WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- (b) INSERT: instructor/admin/student (auto-assign) — re-create unchanged
DROP POLICY IF EXISTS p_assignments_insert_instructor ON assignments;
DROP POLICY IF EXISTS p_assignments_insert ON assignments;
CREATE POLICY p_assignments_insert ON assignments
FOR INSERT
WITH CHECK (
  current_setting('app.current_role', true) IN ('instructor','admin','student')
);

-- (c) UPDATE: reviewer (mark complete) or instructor/admin (manage status)
DROP POLICY IF EXISTS p_assignments_update ON assignments;
CREATE POLICY p_assignments_update ON assignments
FOR UPDATE
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- (d) DELETE: admin only (assignments shouldn't be deleted, only canceled)
DROP POLICY IF EXISTS p_assignments_delete ON assignments;
CREATE POLICY p_assignments_delete ON assignments
FOR DELETE
USING (
  current_setting('app.current_role', true) = 'admin'
);

-- =====================================================
-- REVIEWS
-- =====================================================

-- Drop the old broad ALL policy used for reading
DROP POLICY IF EXISTS p_reviews_reader ON reviews;
DROP POLICY IF EXISTS p_reviews_select ON reviews;

-- (a) SELECT: reviewer, submission owner, instructor/admin
CREATE POLICY p_reviews_select ON reviews
FOR SELECT
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (
    SELECT submission_id FROM submissions
    WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

-- (b) INSERT: reviewer only (already exists, re-create for naming consistency)
DROP POLICY IF EXISTS p_reviews_insert ON reviews;
CREATE POLICY p_reviews_insert ON reviews
FOR INSERT
WITH CHECK (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- (c) UPDATE: reviewer only (edit own review score/comments)
DROP POLICY IF EXISTS p_reviews_update ON reviews;
CREATE POLICY p_reviews_update ON reviews
FOR UPDATE
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
)
WITH CHECK (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- (d) DELETE: reviewer + admin only
DROP POLICY IF EXISTS p_reviews_delete ON reviews;
CREATE POLICY p_reviews_delete ON reviews
FOR DELETE
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR current_setting('app.current_role', true) = 'admin'
);

COMMIT;
