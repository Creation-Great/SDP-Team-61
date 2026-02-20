-- =====================================================
-- Seed data for development/testing
-- =====================================================
-- Password: 'password123' (bcrypt hash, cost 10)
-- Re-generate with:  node -e "require('bcrypt').hash('password123',10).then(console.log)"

INSERT INTO users (email, password_hash, name, role, course_id, group_id) VALUES
  ('instructor@example.com', '$2b$10$7DRGsN7cGagXmlse5BJ0SO5J77KXkKvjpYP/4LcCAvhAthGLgIgqu', 'Dr. Smith', 'instructor', 'CSE4939W', NULL),
  ('alice@example.com',      '$2b$10$7DRGsN7cGagXmlse5BJ0SO5J77KXkKvjpYP/4LcCAvhAthGLgIgqu', 'Alice Wang', 'student', 'CSE4939W', 'G1'),
  ('bob@example.com',        '$2b$10$7DRGsN7cGagXmlse5BJ0SO5J77KXkKvjpYP/4LcCAvhAthGLgIgqu', 'Bob Johnson', 'student', 'CSE4939W', 'G1'),
  ('carol@example.com',      '$2b$10$7DRGsN7cGagXmlse5BJ0SO5J77KXkKvjpYP/4LcCAvhAthGLgIgqu', 'Carol Lee', 'student', 'CSE4939W', 'G2')
ON CONFLICT (email) DO NOTHING;
