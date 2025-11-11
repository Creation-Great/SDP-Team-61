
\timing on
\set QUIET off

\echo 'YANXIAO V2 MIGRATION VALIDATION';
\echo '';
\echo '1. Schema Validation';

-- Check new tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (SELECT table_name FROM information_schema.tables) 
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END AS status
FROM (VALUES 
  ('ml_inference_logs'),
  ('fairness_metrics')
) AS expected(table_name);

-- Check new columns exist
SELECT 
  t.table_name || '.' || t.column_name AS column_path,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_name = t.table_name 
        AND c.column_name = t.column_name
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END AS status
FROM (VALUES 
  ('assignments', 'strategy'),
  ('assignments', 'score'),
  ('assignments', 'cost_vector'),
  ('assignments', 'fairness_snapshot'),
  ('audit', 'hash_payload'),
  ('audit', 'correlation_id'),
  ('users', 'hashed_email'),
  ('rewrite_suggestions', 'edit_distance')
) AS t(table_name, column_name);

-- Check indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('assignments', 'ml_inference_logs', 'fairness_metrics', 'audit')
  AND (
    indexname LIKE '%visibility%' OR
    indexname LIKE '%ml_logs%' OR
    indexname LIKE '%fairness%' OR
    indexname LIKE '%correlation%' OR
    indexname LIKE '%gin%'
  )
ORDER BY tablename, indexname;

SELECT 
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name LIKE 'v_%'
  AND table_name IN ('v_adoption_rate', 'v_workload_variance', 'v_ml_latency_stats', 'v_assignment_explain')
ORDER BY table_name;

\echo '';
\echo '2. Data Integrity Checks';

SELECT 
  'assignments.strategy' AS field,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE strategy IS NULL) AS null_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE strategy IS NULL) / NULLIF(COUNT(*), 0), 2) AS null_percentage
FROM assignments
UNION ALL
SELECT 
  'assignments.cost_vector',
  COUNT(*),
  COUNT(*) FILTER (WHERE cost_vector IS NULL),
  ROUND(100.0 * COUNT(*) FILTER (WHERE cost_vector IS NULL) / NULLIF(COUNT(*), 0), 2)
FROM assignments
UNION ALL
SELECT 
  'audit.hash_payload',
  COUNT(*),
  COUNT(*) FILTER (WHERE hash_payload IS NULL),
  ROUND(100.0 * COUNT(*) FILTER (WHERE hash_payload IS NULL) / NULLIF(COUNT(*), 0), 2)
FROM audit;

-- Check JSONB structure validity
SELECT 
  'assignments.cost_vector' AS field,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE jsonb_typeof(cost_vector) = 'object') AS valid_json_objects,
  COUNT(*) FILTER (WHERE cost_vector ? 'workload' OR cost_vector ? 'diversity' OR cost_vector ? 'conflict') AS has_expected_keys
FROM assignments
WHERE cost_vector IS NOT NULL;

-- ==========================================
-- 3. Performance Baselines
-- ==========================================
\echo '';
\echo '3. Performance Baselines';
\echo '-------------------------';

-- Baseline 1: Assignment visibility query (by submission)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  assignment_id,
  reviewer_id,
  strategy,
  score,
  cost_vector,
  fairness_snapshot,
  status,
  created_at
FROM assignments
WHERE submission_id = (SELECT submission_id FROM submissions LIMIT 1)
  AND status <> 'canceled'
ORDER BY created_at DESC;

-- Baseline 2: Assignment visibility query (by reviewer)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  assignment_id,
  submission_id,
  strategy,
  score,
  cost_vector,
  status,
  created_at
FROM assignments
WHERE reviewer_id = (SELECT user_id FROM users WHERE role = 'student' LIMIT 1)
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 50;

-- Baseline 3: Explain view query
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM v_assignment_explain
WHERE assignment_id = (SELECT assignment_id FROM assignments LIMIT 1);

-- Baseline 4: ML logs aggregation
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  task,
  model_name,
  COUNT(*) AS inference_count,
  ROUND(AVG(latency_ms), 2) AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
FROM ml_inference_logs
WHERE created_at >= now() - interval '7 days'
GROUP BY task, model_name;

-- Baseline 5: Workload variance calculation
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM v_workload_variance
WHERE day >= now() - interval '30 days'
ORDER BY day DESC
LIMIT 30;

-- ==========================================
-- 4. Index Usage Statistics
-- ==========================================
\echo '';
\echo '4. Index Usage Statistics';
\echo '--------------------------';

SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('assignments', 'ml_inference_logs', 'fairness_metrics', 'audit')
ORDER BY idx_scan DESC;

-- ==========================================
-- 5. Table Statistics
-- ==========================================
\echo '';
\echo '5. Table Statistics';
\echo '--------------------';

SELECT 
  schemaname,
  relname AS table_name,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  n_tup_ins AS inserts,
  n_tup_upd AS updates,
  n_tup_del AS deletes,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE relname IN ('assignments', 'ml_inference_logs', 'fairness_metrics', 'audit', 'submissions', 'reviews')
ORDER BY n_live_tup DESC;

-- ==========================================
-- 6. RLS Policy Verification
-- ==========================================
\echo '';
\echo '6. RLS Policy Verification';
\echo '----------------------------';

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE tablename IN ('assignments', 'ml_inference_logs', 'fairness_metrics')
ORDER BY tablename, policyname;

-- ==========================================
-- 7. Sample Data Verification
-- ==========================================
\echo '';
\echo '7. Sample Data Verification';
\echo '-----------------------------';

-- Sample assignments with new fields
SELECT 
  assignment_id,
  strategy,
  score,
  cost_vector->>'workload' AS cost_workload,
  cost_vector->>'diversity' AS cost_diversity,
  fairness_snapshot->>'tpr_gap' AS tpr_gap,
  status,
  created_at
FROM assignments
ORDER BY created_at DESC
LIMIT 5;

-- ==========================================
-- 8. Query Performance Summary
-- ==========================================
\echo '';
\echo '8. Query Performance Summary';
\echo '------------------------------';

-- Top 10 slowest queries involving new tables
SELECT 
  LEFT(query, 100) AS query_snippet,
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
  ROUND(stddev_exec_time::numeric, 2) AS stddev_ms,
  ROUND(max_exec_time::numeric, 2) AS max_ms
FROM pg_stat_statements
WHERE query ILIKE '%assignments%' 
   OR query ILIKE '%ml_inference_logs%'
   OR query ILIKE '%fairness_metrics%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- ==========================================
-- 9. Performance Targets
-- ==========================================
\echo '';
\echo '9. Performance Targets (from Directive)';
\echo '-----------------------------------------';
\echo 'Target: P95 query latency < 50ms';
\echo 'Target: Assignment visibility query with pagination < 100ms';
\echo 'Target: ML log insertion < 10ms';
\echo 'Target: Fairness metrics calculation < 500ms';
\echo '';
\echo 'Compare actual measurements above with targets.';

-- ==========================================
-- 10. Recommendations
-- ==========================================
\echo '';
\echo '10. Post-Validation Recommendations';
\echo '-------------------------------------';
\echo '✓ Run ANALYZE on all affected tables';
\echo '✓ Monitor pg_stat_statements for slow queries';
\echo '✓ Set up alerting for P95 latency > 50ms';
\echo '✓ Configure autovacuum for high-churn tables';
\echo '✓ Review and optimize any queries exceeding targets';
\echo '';

-- Run ANALYZE
ANALYZE assignments;
ANALYZE ml_inference_logs;
ANALYZE fairness_metrics;
ANALYZE audit;

\echo '==========================================';
\echo 'VALIDATION COMPLETE';
\echo '==========================================';

\timing off
