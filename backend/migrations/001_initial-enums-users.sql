-- Migration 001: Extensions, enums, and users table
-- Up Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('pending','completed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student','instructor','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM ('submitted','reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'student',
  course_id     TEXT,
  group_id      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit (
  event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor      UUID,
  action     TEXT,
  entity     TEXT,
  entity_id  UUID,
  meta_json  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
