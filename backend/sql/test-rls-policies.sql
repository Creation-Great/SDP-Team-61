-- =====================================================
-- Row-Level Security (RLS) Test Script
-- Owner: Yanxiao Zheng
-- Purpose: Validate RLS policies for all sensitive tables
-- =====================================================

\echo '====== Testing Row-Level Security Policies ======'
\echo ''

-- Setup: Create test users
BEGIN;

-- Test users (we'll use real UUIDs for this test)
INSERT INTO users (user_id, netid, role, course_id, group_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student1', 'student', 'CS101', 'G1'),
  ('22222222-2222-2222-2222-222222222222', 'student2', 'student', 'CS101', 'G1'),
  ('33333333-3333-3333-3333-333333333333', 'instructor1', 'instructor', 'CS101', NULL),
  ('44444444-4444-4444-4444-444444444444', 'admin1', 'admin', 'CS101', NULL),
  ('55555555-5555-5555-5555-555555555555', 'student3', 'student', 'CS102', 'G2')
ON CONFLICT (netid) DO NOTHING;

-- Test submissions
INSERT INTO submissions (submission_id, user_id, title) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Student1 Paper'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Student2 Paper')
ON CONFLICT (submission_id) DO NOTHING;

-- Test assignments
INSERT INTO assignments (assignment_id, submission_id, reviewer_id, status) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'pending'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'completed')
ON CONFLICT (assignment_id) DO NOTHING;

-- Test reviews
INSERT INTO reviews (review_id, submission_id, reviewer_id, score) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 85)
ON CONFLICT (review_id) DO NOTHING;

COMMIT;

\echo 'Test data created'
\echo ''

-- =====================================================
-- Test 1: Submissions RLS
-- =====================================================
\echo '=== Test 1: Submissions RLS ==='
\echo ''

\echo 'Test 1.1: Student can see own submission'
BEGIN;
SELECT set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM submissions 
      WHERE submission_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    ) THEN '✓ PASS: Student can see own submission'
    ELSE '✗ FAIL: Student cannot see own submission'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 1.2: Student cannot see other student submission (unless assigned)'
BEGIN;
SELECT set_config('app.current_user_id', '55555555-5555-5555-5555-555555555555', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM submissions 
      WHERE submission_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    ) THEN '✓ PASS: Student cannot see other course submission'
    ELSE '✗ FAIL: Student can see other course submission (security breach!)'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 1.3: Student can see submission they are assigned to review'
BEGIN;
SELECT set_config('app.current_user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM submissions 
      WHERE submission_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    ) THEN '✓ PASS: Assigned reviewer can see submission'
    ELSE '✗ FAIL: Assigned reviewer cannot see submission'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 1.4: Instructor can see all submissions in their course'
BEGIN;
SELECT set_config('app.current_user_id', '33333333-3333-3333-3333-333333333333', true);
SELECT set_config('app.current_role', 'instructor', true);

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM submissions WHERE user_id IN (
      SELECT user_id FROM users WHERE course_id = 'CS101'
    )) >= 2
    THEN '✓ PASS: Instructor can see all course submissions'
    ELSE '✗ FAIL: Instructor cannot see all course submissions'
  END as result;

ROLLBACK;
\echo ''

-- =====================================================
-- Test 2: Assignments RLS
-- =====================================================
\echo '=== Test 2: Assignments RLS ==='
\echo ''

\echo 'Test 2.1: Student can see assignments where they are reviewer'
BEGIN;
SELECT set_config('app.current_user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM assignments 
      WHERE assignment_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    ) THEN '✓ PASS: Student can see their reviewer assignments'
    ELSE '✗ FAIL: Student cannot see their reviewer assignments'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 2.2: Student can see assignments for their own submissions'
BEGIN;
SELECT set_config('app.current_user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM assignments 
      WHERE assignment_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    ) THEN '✓ PASS: Student can see who is reviewing their submission'
    ELSE '✗ FAIL: Student cannot see who is reviewing their submission'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 2.3: Student cannot see assignments for other submissions (not assigned)'
BEGIN;
SELECT set_config('app.current_user_id', '55555555-5555-5555-5555-555555555555', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM assignments 
      WHERE assignment_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    ) THEN '✓ PASS: Student cannot see other assignments'
    ELSE '✗ FAIL: Student can see other assignments (security breach!)'
  END as result;

ROLLBACK;
\echo ''

-- =====================================================
-- Test 3: Reviews RLS
-- =====================================================
\echo '=== Test 3: Reviews RLS ==='
\echo ''

\echo 'Test 3.1: Reviewer can see their own reviews'
BEGIN;
SELECT set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM reviews 
      WHERE review_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    ) THEN '✓ PASS: Reviewer can see their own review'
    ELSE '✗ FAIL: Reviewer cannot see their own review'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 3.2: Submission owner can see reviews of their submission'
BEGIN;
SELECT set_config('app.current_user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM reviews 
      WHERE review_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    ) THEN '✓ PASS: Submission owner can see reviews'
    ELSE '✗ FAIL: Submission owner cannot see reviews'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 3.3: Unrelated student cannot see other reviews'
BEGIN;
SELECT set_config('app.current_user_id', '55555555-5555-5555-5555-555555555555', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM reviews 
      WHERE review_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    ) THEN '✓ PASS: Unrelated student cannot see reviews'
    ELSE '✗ FAIL: Unrelated student can see reviews (security breach!)'
  END as result;

ROLLBACK;
\echo ''

-- =====================================================
-- Test 4: Risk Flags RLS
-- =====================================================
\echo '=== Test 4: Risk Flags RLS ==='
\echo ''

-- Create test risk flag
BEGIN;
INSERT INTO risk_flags (
  flag_id, course_id, review_id, flag_type, severity, score, message
) VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'CS101',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'toxicity',
  'high',
  0.85,
  'Detected harsh language'
) ON CONFLICT (flag_id) DO NOTHING;
COMMIT;

\echo 'Test 4.1: Reviewer can see flags on their own review'
BEGIN;
SELECT set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM risk_flags 
      WHERE flag_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    ) THEN '✓ PASS: Reviewer can see flags on their review'
    ELSE '✗ FAIL: Reviewer cannot see flags on their review'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 4.2: Submission owner can see flags on reviews of their submission'
BEGIN;
SELECT set_config('app.current_user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM risk_flags 
      WHERE flag_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    ) THEN '✓ PASS: Submission owner can see flags'
    ELSE '✗ FAIL: Submission owner cannot see flags'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 4.3: Instructor can see all flags in their course'
BEGIN;
SELECT set_config('app.current_user_id', '33333333-3333-3333-3333-333333333333', true);
SELECT set_config('app.current_role', 'instructor', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM risk_flags 
      WHERE flag_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    ) THEN '✓ PASS: Instructor can see all course flags'
    ELSE '✗ FAIL: Instructor cannot see course flags'
  END as result;

ROLLBACK;
\echo ''

-- =====================================================
-- Test 5: Audit RLS
-- =====================================================
\echo '=== Test 5: Audit RLS ==='
\echo ''

-- Create test audit logs
BEGIN;
INSERT INTO audit (event_id, actor, action, entity, entity_id) VALUES
  ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'REVIEW', 'review', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'CREATE', 'submission', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (event_id) DO NOTHING;
COMMIT;

\echo 'Test 5.1: Student can see their own audit logs'
BEGIN;
SELECT set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM audit 
      WHERE event_id = '99999999-9999-9999-9999-999999999999'
    ) THEN '✓ PASS: Student can see their own audit logs'
    ELSE '✗ FAIL: Student cannot see their own audit logs'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 5.2: Student cannot see other student audit logs'
BEGIN;
SELECT set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.current_role', 'student', true);

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM audit 
      WHERE event_id = '88888888-8888-8888-8888-888888888888'
    ) THEN '✓ PASS: Student cannot see other audit logs'
    ELSE '✗ FAIL: Student can see other audit logs (security breach!)'
  END as result;

ROLLBACK;
\echo ''

\echo 'Test 5.3: Instructor can see all audit logs in their course'
BEGIN;
SELECT set_config('app.current_user_id', '33333333-3333-3333-3333-333333333333', true);
SELECT set_config('app.current_role', 'instructor', true);

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM audit WHERE actor IN (
      SELECT user_id FROM users WHERE course_id = 'CS101'
    )) >= 2
    THEN '✓ PASS: Instructor can see all course audit logs'
    ELSE '✗ FAIL: Instructor cannot see all course audit logs'
  END as result;

ROLLBACK;
\echo ''

-- =====================================================
-- Test 6: Write Permissions
-- =====================================================
\echo '=== Test 6: Write Permissions ==='
\echo ''

\echo 'Test 6.1: Student can insert their own submission'
BEGIN;
SELECT set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.current_role', 'student', true);

BEGIN;
  INSERT INTO submissions (submission_id, user_id, title)
  VALUES ('test1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Test Submission');
  
  SELECT '✓ PASS: Student can insert own submission' as result;
EXCEPTION
  WHEN OTHERS THEN
    SELECT '✗ FAIL: Student cannot insert own submission: ' || SQLERRM as result;
END;

ROLLBACK;
\echo ''

\echo 'Test 6.2: Student cannot insert submission for another user'
BEGIN;
SELECT set_config('app.current_user_id', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('app.current_role', 'student', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO submissions (submission_id, user_id, title)
    VALUES ('test2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Fake Submission');
    
    RAISE EXCEPTION 'Security breach: Student inserted submission for another user!';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE '✓ PASS: Student cannot insert submission for another user';
  END;
END $$;

ROLLBACK;
\echo ''

\echo 'Test 6.3: Student can update their assignment status'
BEGIN;
SELECT set_config('app.current_user_id', '22222222-2222-2222-2222-222222222222', true);
SELECT set_config('app.current_role', 'student', true);

BEGIN;
  UPDATE assignments
  SET status = 'completed'
  WHERE assignment_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  
  SELECT '✓ PASS: Student can update their assignment status' as result;
EXCEPTION
  WHEN OTHERS THEN
    SELECT '✗ FAIL: Student cannot update assignment: ' || SQLERRM as result;
END;

ROLLBACK;
\echo ''

\echo 'Test 6.4: Only instructor can create assignments'
BEGIN;
SELECT set_config('app.current_user_id', '33333333-3333-3333-3333-333333333333', true);
SELECT set_config('app.current_role', 'instructor', true);

BEGIN;
  INSERT INTO assignments (assignment_id, submission_id, reviewer_id, status)
  VALUES ('test3333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'pending');
  
  SELECT '✓ PASS: Instructor can create assignments' as result;
EXCEPTION
  WHEN OTHERS THEN
    SELECT '✗ FAIL: Instructor cannot create assignments: ' || SQLERRM as result;
END;

ROLLBACK;
\echo ''

-- =====================================================
-- Summary
-- =====================================================
\echo ''
\echo '====== RLS Testing Complete ======'
\echo ''
\echo 'Review all results above. All tests should show ✓ PASS.'
\echo 'Any ✗ FAIL indicates a security vulnerability that must be fixed!'
\echo ''
\echo 'Cleanup: Test data remains in database for manual verification.'
\echo 'To remove: DELETE FROM audit WHERE event_id IN (\'99999999...\', \'88888888...\');'
\echo '          DELETE FROM risk_flags WHERE flag_id = \'ffffffff...\';'
\echo '          DELETE FROM reviews WHERE review_id = \'eeeeeeee...\';'
\echo '          DELETE FROM assignments WHERE assignment_id IN (\'cccccccc...\', \'dddddddd...\');'
\echo '          DELETE FROM submissions WHERE submission_id IN (\'aaaaaaaa...\', \'bbbbbbbb...\');'
\echo '          DELETE FROM users WHERE netid IN (\'student1\', \'student2\', \'instructor1\', \'admin1\', \'student3\');'
\echo ''
