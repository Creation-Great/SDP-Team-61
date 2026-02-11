-- =====================================================
-- Seed data for development/testing
-- =====================================================
-- Password: 'password123' (bcrypt hash)
-- Generated with: bcrypt.hash('password123', 10)

INSERT INTO users (email, password_hash, name, role, course_id, group_id) VALUES
  ('instructor@example.com', '$2b$10$YourHashHere', 'Dr. Smith', 'instructor', 'CSE4939W', NULL),
  ('alice@example.com', '$2b$10$YourHashHere', 'Alice Wang', 'student', 'CSE4939W', 'G1'),
  ('bob@example.com', '$2b$10$YourHashHere', 'Bob Johnson', 'student', 'CSE4939W', 'G1'),
  ('carol@example.com', '$2b$10$YourHashHere', 'Carol Lee', 'student', 'CSE4939W', 'G2')
ON CONFLICT (email) DO NOTHING;
