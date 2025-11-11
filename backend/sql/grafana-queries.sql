-- Grafana Dashboard Queries
-- Usage: Import queries into Grafana PostgreSQL datasource

-- Panel 1: Suggestion Adoption Rate (Time Series)
SELECT 
  day AS time,
  adoption_rate,
  adopted_count,
  rejected_count,
  total_suggestions
FROM v_adoption_rate
WHERE day >= $__timeFrom()::timestamptz 
  AND day <= $__timeTo()::timestamptz
ORDER BY day;

-- Panel 2: Workload Variance (Time Series)
SELECT 
  day AS time,
  workload_variance,
  stddev_assignments,
  avg_assignments,
  max_assignments - min_assignments AS range_assignments,
  active_reviewers
FROM v_workload_variance
WHERE day >= $__timeFrom()::timestamptz 
  AND day <= $__timeTo()::timestamptz
ORDER BY day;

SELECT 
  hour AS time,
  task,
  model_name,
  avg_latency_ms,
  p50_latency_ms,
  p95_latency_ms,
  p99_latency_ms,
  inference_count,
  error_count
FROM v_ml_latency_stats
WHERE hour >= $__timeFrom()::timestamptz 
  AND hour <= $__timeTo()::timestamptz
ORDER BY hour, task;

-- Separate query for error rate percentage
SELECT 
  hour AS time,
  task,
  model_name,
  ROUND(100.0 * error_count / NULLIF(inference_count, 0), 2) AS error_rate_pct
FROM v_ml_latency_stats
WHERE hour >= $__timeFrom()::timestamptz 
  AND hour <= $__timeTo()::timestamptz
  AND error_count > 0
ORDER BY hour, task;

SELECT 
  computed_at AS time,
  strategy,
  (metric->>'tpr_gap')::NUMERIC AS tpr_gap,
  (metric->>'fpr_gap')::NUMERIC AS fpr_gap,
  (metric->>'demographic_parity')::NUMERIC AS demographic_parity,
  (metric->>'workload_gini')::NUMERIC AS workload_gini
FROM fairness_metrics
WHERE computed_at >= $__timeFrom()::timestamptz 
  AND computed_at <= $__timeTo()::timestamptz
ORDER BY computed_at;

SELECT 
  COALESCE(strategy, 'unspecified') AS strategy,
  COUNT(*) AS assignment_count,
  ROUND(AVG(score), 3) AS avg_score
FROM assignments
WHERE created_at >= $__timeFrom()::timestamptz 
  AND created_at <= $__timeTo()::timestamptz
  AND status <> 'canceled'
GROUP BY strategy
ORDER BY assignment_count DESC;

-- ==========================================
-- Panel 6: Review Completion Rate
-- ==========================================
-- Description: Track review submission vs assignments
-- Expected: > 80% completion rate
-- Alert: completion_rate < 60%
SELECT 
  date_trunc('day', a.created_at) AS time,
  COUNT(DISTINCT a.assignment_id) AS total_assignments,
  COUNT(DISTINCT r.review_id) AS completed_reviews,
  ROUND(100.0 * COUNT(DISTINCT r.review_id) / NULLIF(COUNT(DISTINCT a.assignment_id), 0), 2) AS completion_rate_pct
FROM assignments a
LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
WHERE a.created_at >= $__timeFrom()::timestamptz 
  AND a.created_at <= $__timeTo()::timestamptz
  AND a.status <> 'canceled'
GROUP BY date_trunc('day', a.created_at)
ORDER BY time;

SELECT 
  date_trunc('hour', created_at) AS time,
  AVG((cost_vector->>'workload')::NUMERIC) AS avg_workload_cost,
  AVG((cost_vector->>'diversity')::NUMERIC) AS avg_diversity_cost,
  AVG((cost_vector->>'conflict')::NUMERIC) AS avg_conflict_cost,
  AVG(score) AS avg_total_score
FROM assignments
WHERE created_at >= $__timeFrom()::timestamptz 
  AND created_at <= $__timeTo()::timestamptz
  AND cost_vector IS NOT NULL
  AND status <> 'canceled'
GROUP BY date_trunc('hour', created_at)
ORDER BY time;

SELECT 
  date_trunc('hour', created_at) AS time,
  action,
  COUNT(*) AS event_count
FROM audit
WHERE created_at >= $__timeFrom()::timestamptz 
  AND created_at <= $__timeTo()::timestamptz
GROUP BY date_trunc('hour', created_at), action
ORDER BY time, action;

SELECT 
  u.netid AS reviewer,
  u.role,
  COUNT(a.assignment_id) AS total_assignments,
  COUNT(a.assignment_id) FILTER (WHERE a.status = 'pending') AS pending,
  COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed') AS completed,
  ROUND(AVG(a.score), 3) AS avg_assignment_score
FROM assignments a
JOIN users u ON u.user_id = a.reviewer_id
WHERE a.created_at >= $__timeFrom()::timestamptz 
  AND a.created_at <= $__timeTo()::timestamptz
  AND a.status <> 'canceled'
GROUP BY u.netid, u.role
ORDER BY total_assignments DESC
LIMIT 20;

SELECT COUNT(DISTINCT actor) AS active_users_24h
FROM audit
WHERE created_at >= now() - interval '24 hours';

SELECT COUNT(*) AS submissions_7d
FROM submissions
WHERE created_at >= now() - interval '7 days';

-- Pending reviews
SELECT COUNT(*) AS pending_reviews
FROM v_reviewer_todo;

-- Average response time (audit log based)
SELECT 
  ROUND(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / NULLIF(COUNT(*), 0), 2) AS avg_seconds_between_actions
FROM audit
WHERE created_at >= now() - interval '1 hour';

WITH fairness_with_lag AS (
  SELECT 
    computed_at,
    strategy,
    (metric->>'tpr_gap')::NUMERIC AS tpr_gap,
    LAG((metric->>'tpr_gap')::NUMERIC) OVER (PARTITION BY strategy ORDER BY computed_at) AS prev_tpr_gap,
    (metric->>'fpr_gap')::NUMERIC AS fpr_gap,
    LAG((metric->>'fpr_gap')::NUMERIC) OVER (PARTITION BY strategy ORDER BY computed_at) AS prev_fpr_gap
  FROM fairness_metrics
  WHERE computed_at >= $__timeFrom()::timestamptz 
    AND computed_at <= $__timeTo()::timestamptz
)
SELECT 
  computed_at AS time,
  strategy,
  tpr_gap,
  tpr_gap - prev_tpr_gap AS tpr_gap_delta,
  fpr_gap,
  fpr_gap - prev_fpr_gap AS fpr_gap_delta
FROM fairness_with_lag
WHERE prev_tpr_gap IS NOT NULL
ORDER BY computed_at;

SELECT 
  CASE 
    WHEN edit_distance IS NULL THEN 'unknown'
    WHEN edit_distance < 10 THEN '0-10 chars'
    WHEN edit_distance < 50 THEN '10-50 chars'
    WHEN edit_distance < 100 THEN '50-100 chars'
    WHEN edit_distance < 200 THEN '100-200 chars'
    ELSE '200+ chars'
  END AS edit_range,
  COUNT(*) AS suggestion_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE adopted = TRUE) / NULLIF(COUNT(*), 0), 2) AS adoption_rate_pct
FROM rewrite_suggestions
WHERE created_at >= $__timeFrom()::timestamptz 
  AND created_at <= $__timeTo()::timestamptz
GROUP BY edit_range
ORDER BY edit_range;

-- ==========================================
-- ALERTING RULES (Grafana Alert Manager)
-- ==========================================
-- Copy these thresholds into Grafana alert conditions:

/*
Alert: High Workload Variance
Condition: workload_variance > 3.0 for 2 hours
SELECT MAX(workload_variance) FROM v_workload_variance 
WHERE day >= now() - interval '2 hours';

Alert: Low Adoption Rate
Condition: adoption_rate < 0.4 for 7 days
SELECT MIN(adoption_rate) FROM v_adoption_rate 
WHERE day >= now() - interval '7 days';

Alert: High ML Latency
Condition: p95_latency_ms > 1000 for any task
SELECT MAX(p95_latency_ms) FROM v_ml_latency_stats 
WHERE hour >= now() - interval '1 hour';

Alert: Fairness Threshold Breach
Condition: tpr_gap > 0.15 OR fpr_gap > 0.15
SELECT MAX(GREATEST(
  (metric->>'tpr_gap')::NUMERIC, 
  (metric->>'fpr_gap')::NUMERIC
)) FROM fairness_metrics 
WHERE computed_at >= now() - interval '1 hour';

Alert: High Error Rate
Condition: error_count / inference_count > 0.05 (5%)
SELECT MAX(error_count::FLOAT / NULLIF(inference_count, 0))
FROM v_ml_latency_stats 
WHERE hour >= now() - interval '1 hour';
*/

-- ==========================================
-- PERFORMANCE TIPS
-- ==========================================
-- 1. Refresh materialized views regularly:
--    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_instructor_cohort;
--
-- 2. Set appropriate time ranges in Grafana (avoid full table scans)
--
-- 3. Add indexes on frequently filtered columns:
--    Already created in upgrade-v2-yanxiao.sql
--
-- 4. Use connection pooling in Grafana datasource
--
-- 5. Monitor query performance in pg_stat_statements
-- ==========================================
