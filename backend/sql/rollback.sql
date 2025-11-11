-- WARNING: This will drop v2 tables and columns. Backup data before running!

BEGIN;

DROP TRIGGER IF EXISTS trg_audit_hash ON audit;
DROP FUNCTION IF EXISTS audit_hash_trigger();
DROP FUNCTION IF EXISTS hash_audit_payload(JSONB, TEXT);
DROP FUNCTION IF EXISTS calc_edit_ratio(TEXT, TEXT);

RAISE NOTICE '✓ Dropped triggers and functions';

DROP VIEW IF EXISTS v_assignment_explain;
DROP VIEW IF EXISTS v_ml_latency_stats;
DROP VIEW IF EXISTS v_workload_variance;
DROP VIEW IF EXISTS v_adoption_rate;

RAISE NOTICE '✓ Dropped views';

DROP INDEX IF EXISTS idx_assignments_fairness_gin;
DROP INDEX IF EXISTS idx_assignments_cost_vector_gin;
DROP INDEX IF EXISTS idx_assignments_strategy_time;
DROP INDEX IF EXISTS idx_assignments_reviewer_active;
DROP INDEX IF EXISTS idx_assignments_visibility;
DROP INDEX IF EXISTS idx_ml_logs_output_gin;
DROP INDEX IF EXISTS idx_ml_logs_model_time;
DROP INDEX IF EXISTS idx_ml_logs_task_time;
DROP INDEX IF EXISTS idx_ml_logs_review;
DROP INDEX IF EXISTS idx_ml_logs_submission;
DROP INDEX IF EXISTS idx_fairness_strategy;
DROP INDEX IF EXISTS idx_fairness_time;
DROP INDEX IF EXISTS idx_audit_action_time;
DROP INDEX IF EXISTS idx_audit_correlation;
DROP INDEX IF EXISTS idx_users_hashed_email;

RAISE NOTICE '✓ Dropped v2 indexes';

DROP POLICY IF EXISTS p_fairness_metrics_reader ON fairness_metrics;
DROP POLICY IF EXISTS p_ml_logs_reader ON ml_inference_logs;

RAISE NOTICE '✓ Dropped RLS policies';

DROP TABLE IF EXISTS fairness_metrics CASCADE;
DROP TABLE IF EXISTS ml_inference_logs CASCADE;

RAISE NOTICE '✓ Dropped new tables';

ALTER TABLE assignments
  DROP COLUMN IF EXISTS fairness_snapshot,
  DROP COLUMN IF EXISTS cost_vector,
  DROP COLUMN IF EXISTS score,
  DROP COLUMN IF EXISTS strategy;

RAISE NOTICE '✓ Removed columns from assignments';

ALTER TABLE audit
  DROP COLUMN IF EXISTS user_agent_hash,
  DROP COLUMN IF EXISTS ip_hash,
  DROP COLUMN IF EXISTS correlation_id,
  DROP COLUMN IF EXISTS hash_payload;

RAISE NOTICE '✓ Removed columns from audit';

ALTER TABLE rewrite_suggestions
  DROP COLUMN IF EXISTS accept_timestamp,
  DROP COLUMN IF EXISTS edit_distance;

RAISE NOTICE '✓ Removed columns from rewrite_suggestions';

ALTER TABLE users
  DROP COLUMN IF EXISTS hashed_email;

RAISE NOTICE '✓ Removed columns from users';

DROP POLICY IF EXISTS p_assignments_reader ON assignments;
CREATE POLICY p_assignments_reader ON assignments
USING (
  reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  OR submission_id IN (SELECT submission_id FROM submissions WHERE user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid)
  OR current_setting('app.current_role', true) IN ('instructor','admin')
);

RAISE NOTICE '✓ Restored original RLS policy';

DO $$
BEGIN
  -- Verify tables dropped
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('ml_inference_logs', 'fairness_metrics')) THEN
    RAISE EXCEPTION 'Failed to drop v2 tables';
  END IF;

  -- Verify columns removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignments' 
      AND column_name IN ('strategy', 'cost_vector', 'fairness_snapshot')
  ) THEN
    RAISE EXCEPTION 'Failed to remove v2 columns from assignments';
  END IF;

  RAISE NOTICE '✓ Rollback validation passed';
END $$;

COMMIT;

RAISE NOTICE 'Rollback complete. Database restored to v1.3.1';
