-- =====================================================
-- Schema Validation Script for v1.4
-- Owner: Yanxiao Zheng
-- Purpose: Verify database schema integrity after migration
-- =====================================================

\echo '====== Validating Database Schema v1.4 ======'
\echo ''

-- 1. Verify all critical tables exist
\echo '1. Checking critical tables...'
SELECT 
  CASE 
    WHEN COUNT(*) = 11 THEN '✓ All 11 critical tables present'
    ELSE '✗ Missing tables! Expected 11, found ' || COUNT(*)
  END as table_check
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'submissions', 'assignments', 'reviews',
    'ml_outputs', 'rewrite_suggestions', 'risk_flags', 'audit',
    'mv_instructor_cohort', 'mv_course_ai_metrics'
  );

\echo ''

-- 2. Verify RLS is enabled on sensitive tables
\echo '2. Checking Row-Level Security...'
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'submissions', 'assignments', 'reviews',
    'ml_outputs', 'rewrite_suggestions', 'risk_flags', 'audit'
  )
ORDER BY tablename;

\echo ''

-- 3. Count RLS policies per table
\echo '3. Counting RLS policies...'
SELECT 
  tablename,
  COUNT(*) as policy_count,
  string_agg(cmd, ', ') as operations
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'submissions', 'assignments', 'reviews',
    'ml_outputs', 'rewrite_suggestions', 'risk_flags', 'audit'
  )
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- 4. Verify audit table extensions
\echo '4. Checking audit table structure...'
SELECT 
  column_name,
  data_type,
  CASE WHEN is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END as nullable
FROM information_schema.columns
WHERE table_name = 'audit'
  AND column_name IN ('correlation_id', 'ip_hash', 'user_agent_hash', 'hash_payload')
ORDER BY column_name;

\echo ''

-- 5. Verify risk_flags table structure
\echo '5. Checking risk_flags table structure...'
SELECT 
  column_name,
  data_type,
  CASE WHEN is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END as nullable
FROM information_schema.columns
WHERE table_name = 'risk_flags'
ORDER BY ordinal_position;

\echo ''

-- 6. Verify indexes on critical tables
\echo '6. Checking critical indexes...'
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE 'idx_risk_flags%'
    OR indexname LIKE 'idx_audit%'
    OR indexname LIKE 'idx_ml_outputs%'
    OR indexname LIKE 'idx_assign_reviewer_pending%'
  )
ORDER BY tablename, indexname;

\echo ''

-- 7. Verify foreign key constraints
\echo '7. Checking foreign key constraints...'
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('risk_flags', 'ml_outputs', 'rewrite_suggestions')
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

-- 8. Verify materialized views
\echo '8. Checking materialized views...'
SELECT 
  schemaname,
  matviewname,
  CASE WHEN ispopulated THEN '✓ Populated' ELSE '✗ Not populated' END as status
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname IN ('mv_instructor_cohort', 'mv_course_ai_metrics')
ORDER BY matviewname;

\echo ''

-- 9. Verify regular views
\echo '9. Checking regular views...'
SELECT 
  schemaname,
  viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
    'v_submission_assignment_counts',
    'v_reviewer_todo',
    'v_course_risk_summary',
    'v_reviewer_bias_stats'
  )
ORDER BY viewname;

\echo ''

-- 10. Verify functions
\echo '10. Checking stored functions...'
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'refresh_mv_instructor_cohort',
    'refresh_mv_course_ai_metrics'
  )
ORDER BY routine_name;

\echo ''

-- 11. Check for missing indexes (recommendations)
\echo '11. Checking for recommended indexes...'
WITH expected_indexes AS (
  SELECT 'assignments' as table_name, 'idx_assign_reviewer_pending' as index_name UNION ALL
  SELECT 'audit', 'idx_audit_correlation' UNION ALL
  SELECT 'audit', 'idx_audit_actor_created' UNION ALL
  SELECT 'audit', 'idx_audit_entity' UNION ALL
  SELECT 'risk_flags', 'idx_risk_flags_course' UNION ALL
  SELECT 'risk_flags', 'idx_risk_flags_unresolved' UNION ALL
  SELECT 'ml_outputs', 'idx_ml_outputs_course' UNION ALL
  SELECT 'rewrite_suggestions', 'idx_rewrite_suggestions_course'
)
SELECT 
  e.table_name,
  e.index_name,
  CASE 
    WHEN i.indexname IS NOT NULL THEN '✓ Present'
    ELSE '✗ MISSING'
  END as status
FROM expected_indexes e
LEFT JOIN pg_indexes i 
  ON i.tablename = e.table_name 
  AND i.indexname = e.index_name
ORDER BY e.table_name, e.index_name;

\echo ''

-- 12. Verify check constraints on risk_flags
\echo '12. Checking risk_flags constraints...'
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'risk_flags'
  AND c.contype = 'c'
ORDER BY conname;

\echo ''

-- 13. Sample data counts
\echo '13. Sample data counts (if seeded)...'
SELECT 
  'users' as table_name, 
  COUNT(*) as row_count 
FROM users
UNION ALL
SELECT 'submissions', COUNT(*) FROM submissions
UNION ALL
SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL
SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL
SELECT 'ml_outputs', COUNT(*) FROM ml_outputs
UNION ALL
SELECT 'risk_flags', COUNT(*) FROM risk_flags
UNION ALL
SELECT 'audit', COUNT(*) FROM audit
ORDER BY table_name;

\echo ''
\echo '====== Validation Complete ======'
\echo ''
\echo 'Review the output above for any ✗ marks indicating missing components.'
\echo 'All critical tables should show ✓ for RLS and have appropriate policies.'
\echo ''
