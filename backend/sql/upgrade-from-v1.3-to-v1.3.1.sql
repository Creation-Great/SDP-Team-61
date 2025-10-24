ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_submissions_insert ON submissions;
CREATE POLICY p_submissions_insert ON submissions
FOR INSERT
WITH CHECK (user_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid);

DROP POLICY IF EXISTS p_assignments_update_student ON assignments;
CREATE POLICY p_assignments_update_student ON assignments
FOR UPDATE
USING (reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid)
WITH CHECK (reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid);

DROP POLICY IF EXISTS p_assignments_insert_instructor ON assignments;
CREATE POLICY p_assignments_insert_instructor ON assignments
FOR INSERT
WITH CHECK (current_setting('app.current_role', true) IN ('instructor','admin'));

DROP POLICY IF EXISTS p_assignments_update_instructor ON assignments;
CREATE POLICY p_assignments_update_instructor ON assignments
FOR UPDATE
USING (current_setting('app.current_role', true) IN ('instructor','admin'))
WITH CHECK (current_setting('app.current_role', true) IN ('instructor','admin'));

DROP POLICY IF EXISTS p_reviews_insert ON reviews;
CREATE POLICY p_reviews_insert ON reviews
FOR INSERT
WITH CHECK (reviewer_id = COALESCE(current_setting('app.current_user_id', true), '00000000-0000-0000-0000-000000000000')::uuid);
