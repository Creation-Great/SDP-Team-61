-- Plagiarism/similarity detection results
CREATE TABLE IF NOT EXISTS similarity_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id_a   UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
  submission_id_b   UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
  similarity_score  NUMERIC(5,4),
  method            TEXT NOT NULL DEFAULT 'tfidf_cosine',
  details           JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id_a, submission_id_b, method)
);
CREATE INDEX IF NOT EXISTS idx_similarity_sub_a ON similarity_reports(submission_id_a);
CREATE INDEX IF NOT EXISTS idx_similarity_sub_b ON similarity_reports(submission_id_b);
