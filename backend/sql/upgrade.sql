
BEGIN;

-- 1. Extend assignments table for visibility
ALTER TABLE assignments 
  ADD COLUMN IF NOT EXISTS strategy TEXT,
  ADD COLUMN IF NOT EXISTS score NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_vector JSONB,
  ADD COLUMN IF NOT EXISTS fairness_snapshot JSONB;

COMMENT ON COLUMN assignments.strategy IS 'Algorithm used: hungarian, ilp, ppo, manual';
COMMENT ON COLUMN assignments.score IS 'Objective function score at assignment time';
COMMENT ON COLUMN assignments.cost_vector IS 'Cost breakdown: {workload, diversity, conflict, etc}';
COMMENT ON COLUMN assignments.fairness_snapshot IS 'Fairness metrics snapshot: {tpr_gap, fpr_gap, demographic_parity, etc}';

-- Update existing rows with default values
UPDATE assignments 
SET strategy = COALESCE(solver_version, 'manual'),
    score = cost,
    cost_vector = jsonb_build_object('total', COALESCE(cost, 0)),
    fairness_snapshot = '{}'::jsonb
WHERE strategy IS NULL;

-- 2. Create ml_inference_logs table
CREATE TABLE IF NOT EXISTS ml_inference_logs (
  infer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(submission_id) ON DELETE SET NULL,
  review_id UUID REFERENCES reviews(review_id) ON DELETE SET NULL,
  model_name TEXT NOT NULL,
  task TEXT NOT NULL CHECK (task IN ('detect', 'rewrite', 'classify', 'embed')),
  input_hash TEXT NOT NULL,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  edit_ratio NUMERIC CHECK (edit_ratio >= 0 AND edit_ratio <= 1),
  latency_ms INTEGER CHECK (latency_ms >= 0),
  error_msg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ml_inference_logs IS 'Privacy-safe ML inference logs (no raw text, only hashes/pointers)';
COMMENT ON COLUMN ml_inference_logs.input_hash IS 'SHA-256 hash of input (for deduplication, not reverse lookup)';
COMMENT ON COLUMN ml_inference_logs.output IS 'Model output: labels, scores, spans, suggestions (no PII)';
COMMENT ON COLUMN ml_inference_logs.edit_ratio IS 'Levenshtein distance ratio for rewrite tasks';

CREATE INDEX IF NOT EXISTS idx_ml_logs_submission ON ml_inference_logs(submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ml_logs_review ON ml_inference_logs(review_id) WHERE review_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ml_logs_task_time ON ml_inference_logs(task, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_logs_model_time ON ml_inference_logs(model_name, created_at DESC);

-- 3. Create fairness_metrics table
CREATE TABLE IF NOT EXISTS fairness_metrics (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy TEXT,
  metric JSONB NOT NULL,
  cohort_filter JSONB DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fairness_metrics IS 'Fairness metrics snapshots for auditing and visualization';
COMMENT ON COLUMN fairness_metrics.metric IS 'Fairness indicators: {tpr_gap, fpr_gap, demographic_parity, equal_opportunity, predictive_equality, workload_gini}';
COMMENT ON COLUMN fairness_metrics.cohort_filter IS 'Optional filters applied: {course_id, group_id, date_range}';

CREATE INDEX IF NOT EXISTS idx_fairness_time ON fairness_metrics(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_fairness_strategy ON fairness_metrics(strategy) WHERE strategy IS NOT NULL;

-- 4. Enhance audit table with hashing
ALTER TABLE audit 
  ADD COLUMN IF NOT EXISTS hash_payload TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;

COMMENT ON COLUMN audit.hash_payload IS 'SHA-256(meta_json + salt) for tamper detection';
COMMENT ON COLUMN audit.correlation_id IS 'Request trace ID for cross-service audit';
COMMENT ON COLUMN audit.ip_hash IS 'Hashed IP address (privacy-safe)';

CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_action_time ON audit(action, created_at DESC);

-- 5. Update rewrite_suggestions schema
ALTER TABLE rewrite_suggestions
  ADD COLUMN IF NOT EXISTS edit_distance INTEGER,
  ADD COLUMN IF NOT EXISTS accept_timestamp TIMESTAMPTZ;

COMMENT ON COLUMN rewrite_suggestions.edit_distance IS 'Levenshtein edit distance for tracking adoption patterns';
COMMENT ON COLUMN rewrite_suggestions.accept_timestamp IS 'When reviewer accepted/rejected suggestion';

-- 6. Add hashed_email to users (privacy)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hashed_email TEXT;

COMMENT ON COLUMN users.hashed_email IS 'SHA-256(email) for lookup without storing plaintext';

-- Create unique index on hashed_email if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_users_hashed_email'
  ) THEN
    CREATE UNIQUE INDEX idx_users_hashed_email ON users(hashed_email) WHERE hashed_email IS NOT NULL;
  END IF;
END $$;

-- 7. Create helper functions
CREATE OR REPLACE FUNCTION calc_edit_ratio(text1 TEXT, text2 TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  max_len INTEGER;
  dist INTEGER;
BEGIN
  max_len := GREATEST(length(text1), length(text2));
  IF max_len = 0 THEN RETURN 0; END IF;
  
  dist := levenshtein(text1, text2);
  RETURN ROUND((dist::NUMERIC / max_len::NUMERIC), 4);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION hash_audit_payload(payload JSONB, salt TEXT DEFAULT '')
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN encode(digest(payload::TEXT || salt, 'sha256'), 'hex');
END;
$$;

-- 8. Create views for metrics
CREATE OR REPLACE VIEW v_adoption_rate AS
SELECT 
  date_trunc('day', created_at) AS day,
  COUNT(*) FILTER (WHERE adopted = TRUE) AS adopted_count,
  COUNT(*) FILTER (WHERE adopted = FALSE) AS rejected_count,
  COUNT(*) AS total_suggestions,
  ROUND(AVG(CASE WHEN adopted THEN 1 ELSE 0 END), 4) AS adoption_rate
FROM rewrite_suggestions
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW v_workload_variance AS
SELECT 
  date_trunc('day', a.created_at) AS day,
  COUNT(DISTINCT a.reviewer_id) AS active_reviewers,
  ROUND(AVG(cnt), 2) AS avg_assignments,
  ROUND(STDDEV_POP(cnt), 2) AS stddev_assignments,
  ROUND(VAR_POP(cnt), 2) AS workload_variance,
  MAX(cnt) AS max_assignments,
  MIN(cnt) AS min_assignments
FROM (
  SELECT reviewer_id, date_trunc('day', created_at) AS day, COUNT(*) AS cnt
  FROM assignments
  WHERE status <> 'canceled'
  GROUP BY reviewer_id, date_trunc('day', created_at)
) a
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW v_ml_latency_stats AS
SELECT 
  task,
  model_name,
  date_trunc('hour', created_at) AS hour,
  COUNT(*) AS inference_count,
  ROUND(AVG(latency_ms), 2) AS avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms), 2) AS p50_latency_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 2) AS p95_latency_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 2) AS p99_latency_ms,
  COUNT(*) FILTER (WHERE error_msg IS NOT NULL) AS error_count
FROM ml_inference_logs
GROUP BY task, model_name, date_trunc('hour', created_at)
ORDER BY hour DESC, task, model_name;

CREATE OR REPLACE VIEW v_assignment_explain AS
SELECT 
  a.assignment_id,
  a.submission_id,
  a.reviewer_id,
  a.strategy,
  a.score,
  a.cost_vector,
  a.fairness_snapshot,
  a.status,
  a.created_at,
  u.netid AS reviewer_netid,
  u.role AS reviewer_role,
  s.title AS submission_title,
  s.created_at AS submission_created_at,
  (a.cost_vector->>'workload')::NUMERIC AS cost_workload,
  (a.cost_vector->>'diversity')::NUMERIC AS cost_diversity,
  (a.cost_vector->>'conflict')::NUMERIC AS cost_conflict,
  (a.fairness_snapshot->>'tpr_gap')::NUMERIC AS fairness_tpr_gap,
  (a.fairness_snapshot->>'fpr_gap')::NUMERIC AS fairness_fpr_gap
FROM assignments a
LEFT JOIN users u ON u.user_id = a.reviewer_id
LEFT JOIN submissions s ON s.submission_id = a.submission_id;

-- 9. Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_assignments_visibility 
  ON assignments(submission_id, status, created_at DESC) 
  WHERE status <> 'canceled';

CREATE INDEX IF NOT EXISTS idx_assignments_reviewer_active
  ON assignments(reviewer_id, status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_assignments_strategy_time
  ON assignments(strategy, created_at DESC)
  WHERE strategy IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_cost_vector_gin
  ON assignments USING gin(cost_vector jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_assignments_fairness_gin
  ON assignments USING gin(fairness_snapshot jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_ml_logs_output_gin
  ON ml_inference_logs USING gin(output jsonb_path_ops);

-- 10. Audit trigger for tampering detection
CREATE OR REPLACE FUNCTION audit_hash_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.meta_json IS NOT NULL AND NEW.hash_payload IS NULL THEN
    NEW.hash_payload := hash_audit_payload(NEW.meta_json);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_hash ON audit;
CREATE TRIGGER trg_audit_hash
  BEFORE INSERT ON audit
  FOR EACH ROW
  EXECUTE FUNCTION audit_hash_trigger();

-- 11. Row-level security updates
DROP POLICY IF EXISTS p_assignments_reader ON assignments;
CREATE POLICY p_assignments_reader ON assignments
FOR SELECT
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (
    SELECT submission_id 
    FROM submissions 
    WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

CREATE POLICY p_ml_logs_reader ON ml_inference_logs
FOR SELECT
USING (current_setting('app.current_role', true) IN ('instructor','admin'));

ALTER TABLE ml_inference_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_fairness_metrics_reader ON fairness_metrics
FOR SELECT
USING (current_setting('app.current_role', true) IN ('instructor','admin'));

ALTER TABLE fairness_metrics ENABLE ROW LEVEL SECURITY;

-- 12. Validation and sanity checks
DO $$
DECLARE
  missing_cols TEXT[];
BEGIN
  SELECT array_agg(col) INTO missing_cols
  FROM (VALUES 
    ('assignments', 'strategy'),
    ('assignments', 'cost_vector'),
    ('assignments', 'fairness_snapshot'),
    ('users', 'hashed_email'),
    ('audit', 'hash_payload'),
    ('audit', 'correlation_id')
  ) AS expected(tbl, col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = expected.tbl 
      AND c.column_name = expected.col
  );

  IF missing_cols IS NOT NULL THEN
    RAISE EXCEPTION 'Missing columns after migration: %', missing_cols;
  END IF;

  RAISE NOTICE '✓ All columns created successfully';
END $$;

-- Verify new tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ml_inference_logs') THEN
    RAISE EXCEPTION 'Table ml_inference_logs not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fairness_metrics') THEN
    RAISE EXCEPTION 'Table fairness_metrics not created';
  END IF;

  RAISE NOTICE '✓ All tables created successfully';
END $$;

-- Verify indexes
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE tablename IN ('assignments', 'ml_inference_logs', 'fairness_metrics', 'audit')
    AND indexname LIKE '%yanxiao%' OR indexname LIKE '%visibility%' OR indexname LIKE '%ml_logs%';

  RAISE NOTICE '✓ Created % new indexes', idx_count;
END $$;

COMMIT;
