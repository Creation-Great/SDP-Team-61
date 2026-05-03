-- Migration 008: Add ON DELETE CASCADE / SET NULL to all foreign keys
-- Up Migration
--
-- Problem:  Foreign keys lack cascade/set-null policies, so deleting a user
--           or submission causes constraint-violation errors.
-- Strategy:
--   • User-owned data (submissions, reviews, assignments, checkins, peer reviews)
--     → ON DELETE CASCADE  (delete user ⇒ remove their data)
--   • Session ownership (peer_review_sessions.created_by)
--     → ON DELETE SET NULL (keep session + student reviews intact when instructor removed)
--   • Submission-owned data (assignments, reviews)
--     → ON DELETE CASCADE  (delete submission ⇒ remove dependent rows)
--   • Session-owned data (peer_reviews, team_chemistry)
--     → ON DELETE CASCADE  (delete session ⇒ remove reviews)
--
-- Approach: drop old FK, add new FK with cascade. Wrapped in DO blocks for
-- idempotency (constraint may already have the desired action after re-run).
-- PostgreSQL auto-names inline REFERENCES as "<table>_<column>_fkey".

BEGIN;

-- =====================================================
-- 1. submissions.user_id → users(user_id) CASCADE
-- =====================================================
ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_user_id_fkey;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =====================================================
-- 2. assignments.submission_id → submissions(submission_id) CASCADE
-- =====================================================
ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_submission_id_fkey;
ALTER TABLE assignments
  ADD CONSTRAINT assignments_submission_id_fkey
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE CASCADE;

-- =====================================================
-- 3. assignments.reviewer_id → users(user_id) CASCADE
-- =====================================================
ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_reviewer_id_fkey;
ALTER TABLE assignments
  ADD CONSTRAINT assignments_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =====================================================
-- 4. reviews.submission_id → submissions(submission_id) CASCADE
-- =====================================================
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_submission_id_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_submission_id_fkey
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE CASCADE;

-- =====================================================
-- 5. reviews.reviewer_id → users(user_id) CASCADE
-- =====================================================
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =====================================================
-- 6. peer_review_sessions.created_by → users(user_id) SET NULL
--    Also make the column nullable so SET NULL can work.
-- =====================================================
ALTER TABLE peer_review_sessions
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE peer_review_sessions
  DROP CONSTRAINT IF EXISTS peer_review_sessions_created_by_fkey;
ALTER TABLE peer_review_sessions
  ADD CONSTRAINT peer_review_sessions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- =====================================================
-- 7. peer_reviews.session_id → peer_review_sessions(session_id) CASCADE
-- =====================================================
ALTER TABLE peer_reviews
  DROP CONSTRAINT IF EXISTS peer_reviews_session_id_fkey;
ALTER TABLE peer_reviews
  ADD CONSTRAINT peer_reviews_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES peer_review_sessions(session_id) ON DELETE CASCADE;

-- =====================================================
-- 8. peer_reviews.reviewer_id → users(user_id) CASCADE
-- =====================================================
ALTER TABLE peer_reviews
  DROP CONSTRAINT IF EXISTS peer_reviews_reviewer_id_fkey;
ALTER TABLE peer_reviews
  ADD CONSTRAINT peer_reviews_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =====================================================
-- 9. peer_reviews.reviewee_id → users(user_id) CASCADE
-- =====================================================
ALTER TABLE peer_reviews
  DROP CONSTRAINT IF EXISTS peer_reviews_reviewee_id_fkey;
ALTER TABLE peer_reviews
  ADD CONSTRAINT peer_reviews_reviewee_id_fkey
  FOREIGN KEY (reviewee_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =====================================================
-- 10. peer_review_team_chemistry.session_id → sessions CASCADE
-- =====================================================
ALTER TABLE peer_review_team_chemistry
  DROP CONSTRAINT IF EXISTS peer_review_team_chemistry_session_id_fkey;
ALTER TABLE peer_review_team_chemistry
  ADD CONSTRAINT peer_review_team_chemistry_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES peer_review_sessions(session_id) ON DELETE CASCADE;

-- =====================================================
-- 11. peer_review_team_chemistry.reviewer_id → users CASCADE
-- =====================================================
ALTER TABLE peer_review_team_chemistry
  DROP CONSTRAINT IF EXISTS peer_review_team_chemistry_reviewer_id_fkey;
ALTER TABLE peer_review_team_chemistry
  ADD CONSTRAINT peer_review_team_chemistry_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =====================================================
-- 12. student_checkins.instructor_id → users CASCADE
-- =====================================================
ALTER TABLE student_checkins
  DROP CONSTRAINT IF EXISTS student_checkins_instructor_id_fkey;
ALTER TABLE student_checkins
  ADD CONSTRAINT student_checkins_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =====================================================
-- 13. student_self_checkins.student_id → users CASCADE
-- =====================================================
ALTER TABLE student_self_checkins
  DROP CONSTRAINT IF EXISTS student_self_checkins_student_id_fkey;
ALTER TABLE student_self_checkins
  ADD CONSTRAINT student_self_checkins_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =====================================================
-- 14. audit.actor — add FK with SET NULL (actor column is nullable,
--     audit rows should persist even after user deletion)
-- =====================================================
ALTER TABLE audit
  DROP CONSTRAINT IF EXISTS audit_actor_fkey;
ALTER TABLE audit
  ADD CONSTRAINT audit_actor_fkey
  FOREIGN KEY (actor) REFERENCES users(user_id) ON DELETE SET NULL;

COMMIT;
