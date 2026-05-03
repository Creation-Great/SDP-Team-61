-- Migration 020: Data lifecycle cleanup functions
--
-- These functions can be called periodically to remove stale data
-- and keep the database manageable over time.

-- Delete review drafts older than 30 days (abandoned drafts)
CREATE OR REPLACE FUNCTION cleanup_old_drafts() RETURNS integer AS $$
DECLARE
  deleted integer := 0;
  d1 integer;
  d2 integer;
BEGIN
  DELETE FROM file_review_drafts WHERE updated_at < now() - interval '30 days';
  GET DIAGNOSTICS d1 = ROW_COUNT;
  DELETE FROM peer_review_drafts WHERE updated_at < now() - interval '30 days';
  GET DIAGNOSTICS d2 = ROW_COUNT;
  deleted := d1 + d2;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- Delete read notifications older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_notifications() RETURNS integer AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM notifications WHERE is_read = true AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- Delete AI activity logs older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_ai_logs() RETURNS integer AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM ai_activity_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
