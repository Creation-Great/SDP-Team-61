-- 037: Performance indexes and data integrity constraints

-- Composite index for AI activity log queries filtered by user and date
CREATE INDEX IF NOT EXISTS idx_ai_activity_logs_user_created
  ON ai_activity_logs (user_id, created_at DESC);

-- Check constraint: similarity reports should have ordered submission pairs (a < b)
-- to prevent duplicate entries like (A,B) and (B,A)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ck_similarity_ordered_pair'
      AND table_name = 'similarity_reports'
      AND table_schema = 'public'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE similarity_reports
      ADD CONSTRAINT ck_similarity_ordered_pair
      CHECK (submission_id_a < submission_id_b);
  END IF;
END $$;
