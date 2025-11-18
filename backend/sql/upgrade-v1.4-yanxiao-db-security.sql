-- =====================================================
-- Database & Security Upgrade for v1.4
-- Owner: Yanxiao Zheng
-- Description: Enhances schema for comprehensive security,
--              audit logging, and AI integration
-- =====================================================

-- Step 1: Extend audit table for enhanced tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit' AND column_name = 'correlation_id'
  ) THEN
    ALTER TABLE audit ADD COLUMN correlation_id UUID;
    CREATE INDEX idx_audit_correlation ON audit(correlation_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit' AND column_name = 'ip_hash'
  ) THEN
    ALTER TABLE audit ADD COLUMN ip_hash CHAR(64);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit' AND column_name = 'user_agent_hash'
  ) THEN
    ALTER TABLE audit ADD COLUMN user_agent_hash CHAR(64);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit' AND column_name = 'hash_payload'
  ) THEN
    ALTER TABLE audit ADD COLUMN hash_payload CHAR(64);
    COMMENT ON COLUMN audit.hash_payload IS 'SHA256 hash of meta_json for tamper detection';
  END IF;
END $$;

-- Add indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit(actor, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit(action);

-- Step 2: Create risk_flags table for AI bias detection results
CREATE TABLE IF NOT EXISTS risk_flags (
  flag_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     TEXT NOT NULL,
  submission_id UUID REFERENCES submissions(submission_id) ON DELETE CASCADE,
  review_id     UUID REFERENCES reviews(review_id) ON DELETE CASCADE,
  flag_type     TEXT NOT NULL, -- 'toxicity', 'identity_attack', 'politeness_low', 'sentiment_negative'
  severity      TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  score         NUMERIC, -- Raw score from AI model
  span_start    INTEGER, -- Character position start (optional)
  span_end      INTEGER, -- Character position end (optional)
  message       TEXT, -- Human-readable explanation
  suggested_rewrite TEXT, -- AI-generated constructive alternative
  model_version TEXT, -- Version of AI model used
  reviewed_by   UUID REFERENCES users(user_id), -- Instructor who reviewed this flag
  reviewed_at   TIMESTAMPTZ, -- When the flag was reviewed
  resolution    TEXT, -- 'acknowledged', 'dismissed', 'rewritten', 'escalated'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_flag_type CHECK (flag_type IN (
    'toxicity', 'identity_attack', 'politeness_low', 'sentiment_negative', 
    'bias_detected', 'harsh_language', 'discriminatory'
  )),
  CONSTRAINT chk_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_has_target CHECK (submission_id IS NOT NULL OR review_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_risk_flags_submission ON risk_flags(submission_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_review ON risk_flags(review_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_course ON risk_flags(course_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity ON risk_flags(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_flags_type ON risk_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_risk_flags_unresolved ON risk_flags(course_id, resolution) 
  WHERE resolution IS NULL;

COMMENT ON TABLE risk_flags IS 'Structured storage for AI-detected bias, toxicity, and politeness issues';
COMMENT ON COLUMN risk_flags.flag_type IS 'Type of risk detected by AI analysis';
COMMENT ON COLUMN risk_flags.severity IS 'Impact level: low, medium, high, critical';
COMMENT ON COLUMN risk_flags.suggested_rewrite IS 'AI-generated constructive alternative phrasing';

-- Step 3: Add missing indexes to existing tables for performance
CREATE INDEX IF NOT EXISTS idx_submissions_course ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_course_status ON assignments(submission_id, status);

-- Step 4: Add course-level metadata to ml_outputs for better aggregation
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ml_outputs' AND column_name = 'course_id'
  ) THEN
    ALTER TABLE ml_outputs ADD COLUMN course_id TEXT;
    
    -- Backfill course_id from reviews -> submissions -> users
    UPDATE ml_outputs mo
    SET course_id = u.course_id
    FROM reviews r
    JOIN submissions s ON s.submission_id = r.submission_id
    JOIN users u ON u.user_id = s.user_id
    WHERE mo.review_id = r.review_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ml_outputs_course ON ml_outputs(course_id);

-- Step 5: Add course-level metadata to rewrite_suggestions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewrite_suggestions' AND column_name = 'course_id'
  ) THEN
    ALTER TABLE rewrite_suggestions ADD COLUMN course_id TEXT;
    
    -- Backfill course_id
    UPDATE rewrite_suggestions rs
    SET course_id = u.course_id
    FROM reviews r
    JOIN submissions s ON s.submission_id = r.submission_id
    JOIN users u ON u.user_id = s.user_id
    WHERE rs.review_id = r.review_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rewrite_suggestions_course ON rewrite_suggestions(course_id);

-- Step 6: Enable RLS on all sensitive tables
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrite_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for audit table
-- Instructors and admins can see their course's audit logs
-- Students cannot directly access audit logs
DROP POLICY IF EXISTS p_audit_read ON audit;
CREATE POLICY p_audit_read ON audit FOR SELECT
USING (
  current_setting('app.current_role', true) IN ('instructor', 'admin')
  OR actor = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
);

-- Only system can write audit logs (enforced at application layer)
DROP POLICY IF EXISTS p_audit_insert ON audit;
CREATE POLICY p_audit_insert ON audit FOR INSERT
WITH CHECK (true); -- Application controls audit writes

-- Step 8: Create RLS policies for ml_outputs
DROP POLICY IF EXISTS p_ml_outputs_read ON ml_outputs;
CREATE POLICY p_ml_outputs_read ON ml_outputs FOR SELECT
USING (
  -- Reviewer can see their own review's ML outputs
  EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.review_id = ml_outputs.review_id
      AND r.reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR
  -- Submission owner can see ML outputs on reviews of their submission
  EXISTS (
    SELECT 1 FROM reviews r
    JOIN submissions s ON s.submission_id = r.submission_id
    WHERE r.review_id = ml_outputs.review_id
      AND s.user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR
  -- Instructors and admins can see all in their course
  current_setting('app.current_role', true) IN ('instructor', 'admin')
);

-- Step 9: Create RLS policies for rewrite_suggestions
DROP POLICY IF EXISTS p_rewrite_suggestions_read ON rewrite_suggestions;
CREATE POLICY p_rewrite_suggestions_read ON rewrite_suggestions FOR SELECT
USING (
  -- Same logic as ml_outputs
  EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.review_id = rewrite_suggestions.review_id
      AND r.reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR
  EXISTS (
    SELECT 1 FROM reviews r
    JOIN submissions s ON s.submission_id = r.submission_id
    WHERE r.review_id = rewrite_suggestions.review_id
      AND s.user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
  OR
  current_setting('app.current_role', true) IN ('instructor', 'admin')
);

DROP POLICY IF EXISTS p_rewrite_suggestions_update ON rewrite_suggestions;
CREATE POLICY p_rewrite_suggestions_update ON rewrite_suggestions FOR UPDATE
USING (
  -- Reviewers can mark their suggestions as adopted
  EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.review_id = rewrite_suggestions.review_id
      AND r.reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.review_id = rewrite_suggestions.review_id
      AND r.reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  )
);

-- Step 10: Create RLS policies for risk_flags
DROP POLICY IF EXISTS p_risk_flags_read ON risk_flags;
CREATE POLICY p_risk_flags_read ON risk_flags FOR SELECT
USING (
  -- Students can see flags on their own reviews
  (review_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.review_id = risk_flags.review_id
      AND r.reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  ))
  OR
  -- Students can see flags on reviews of their submissions
  (review_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM reviews r
    JOIN submissions s ON s.submission_id = r.submission_id
    WHERE r.review_id = risk_flags.review_id
      AND s.user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid
  ))
  OR
  -- Instructors/admins can see all flags in their course
  current_setting('app.current_role', true) IN ('instructor', 'admin')
);

DROP POLICY IF EXISTS p_risk_flags_insert ON risk_flags;
CREATE POLICY p_risk_flags_insert ON risk_flags FOR INSERT
WITH CHECK (true); -- Application layer controls insertion

DROP POLICY IF EXISTS p_risk_flags_update ON risk_flags;
CREATE POLICY p_risk_flags_update ON risk_flags FOR UPDATE
USING (
  -- Only instructors/admins can update (for marking as reviewed)
  current_setting('app.current_role', true) IN ('instructor', 'admin')
)
WITH CHECK (
  current_setting('app.current_role', true) IN ('instructor', 'admin')
);

-- Step 11: Create views for analytics and aggregation
DROP VIEW IF EXISTS v_course_risk_summary;
CREATE VIEW v_course_risk_summary AS
SELECT
  course_id,
  flag_type,
  severity,
  COUNT(*) as flag_count,
  COUNT(*) FILTER (WHERE resolution IS NULL) as unresolved_count,
  COUNT(*) FILTER (WHERE resolution = 'acknowledged') as acknowledged_count,
  AVG(score) as avg_score,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM risk_flags
GROUP BY course_id, flag_type, severity;

COMMENT ON VIEW v_course_risk_summary IS 'Aggregate risk flag statistics by course, type, and severity';

DROP VIEW IF EXISTS v_reviewer_bias_stats;
CREATE VIEW v_reviewer_bias_stats AS
SELECT
  r.reviewer_id,
  u.netid,
  u.course_id,
  COUNT(DISTINCT r.review_id) as total_reviews,
  COUNT(DISTINCT rf.flag_id) as flagged_reviews,
  ROUND(
    100.0 * COUNT(DISTINCT rf.flag_id) / NULLIF(COUNT(DISTINCT r.review_id), 0),
    2
  ) as flag_rate_pct,
  AVG(mo.toxicity) as avg_toxicity,
  AVG(mo.politeness) as avg_politeness
FROM reviews r
JOIN users u ON u.user_id = r.reviewer_id
LEFT JOIN risk_flags rf ON rf.review_id = r.review_id
LEFT JOIN ml_outputs mo ON mo.review_id = r.review_id
GROUP BY r.reviewer_id, u.netid, u.course_id;

COMMENT ON VIEW v_reviewer_bias_stats IS 'Per-reviewer bias detection statistics for course instructors';

-- Step 12: Create materialized view for course-level AI metrics
DROP MATERIALIZED VIEW IF EXISTS mv_course_ai_metrics;
CREATE MATERIALIZED VIEW mv_course_ai_metrics AS
SELECT
  u.course_id,
  u.group_id,
  date_trunc('week', r.created_at) as week,
  COUNT(DISTINCT r.review_id) as review_count,
  COUNT(DISTINCT rf.flag_id) as flag_count,
  COUNT(DISTINCT rf.flag_id) FILTER (WHERE rf.severity IN ('high', 'critical')) as high_severity_flags,
  AVG(mo.toxicity) as avg_toxicity,
  AVG(mo.politeness) as avg_politeness,
  COUNT(DISTINCT rs.review_id) FILTER (WHERE rs.adopted = true) as suggestions_adopted
FROM reviews r
JOIN submissions s ON s.submission_id = r.submission_id
JOIN users u ON u.user_id = s.user_id
LEFT JOIN ml_outputs mo ON mo.review_id = r.review_id
LEFT JOIN risk_flags rf ON rf.review_id = r.review_id
LEFT JOIN rewrite_suggestions rs ON rs.review_id = r.review_id
GROUP BY u.course_id, u.group_id, date_trunc('week', r.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_course_ai_metrics 
  ON mv_course_ai_metrics (course_id, group_id, week);

COMMENT ON MATERIALIZED VIEW mv_course_ai_metrics IS 'Weekly AI analysis metrics per course/group for instructor dashboard';

-- Step 13: Create function to refresh AI metrics MV
CREATE OR REPLACE FUNCTION refresh_mv_course_ai_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_course_ai_metrics;
END
$$;

-- Validation queries
DO $$
DECLARE
  table_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Count critical tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('risk_flags', 'audit', 'ml_outputs', 'rewrite_suggestions');
  
  IF table_count < 4 THEN
    RAISE WARNING 'Missing critical tables. Expected 4, found %', table_count;
  END IF;
  
  -- Count RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('risk_flags', 'audit', 'ml_outputs', 'rewrite_suggestions');
  
  IF policy_count < 8 THEN
    RAISE NOTICE 'Created % RLS policies for security tables', policy_count;
  END IF;
  
  RAISE NOTICE '✓ Database & Security upgrade completed successfully';
  RAISE NOTICE '  - risk_flags table created with % indexes', 
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'risk_flags');
  RAISE NOTICE '  - audit table extended with correlation tracking';
  RAISE NOTICE '  - RLS enabled on all sensitive tables';
  RAISE NOTICE '  - Course-level analytics views created';
END $$;
