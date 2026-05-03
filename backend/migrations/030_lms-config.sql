-- LMS integration configuration (mock)
CREATE TABLE IF NOT EXISTS lms_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         TEXT NOT NULL UNIQUE,
  provider          TEXT NOT NULL DEFAULT 'none',
  api_url           TEXT,
  api_key           TEXT,
  lti_consumer_key  TEXT,
  lti_secret        TEXT,
  config_json       JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
