-- =====================================================
-- SDP-Team-61 Seed Data
-- Password for all accounts: 'password123'
-- =====================================================

INSERT INTO users (email, password_hash, name, role, netid) VALUES
  ('instructor@uconn.edu', '$2b$10$07rtUmvgm.Zbrbv4yJKP4OTcRRopEdAIoFohQyVb6Lrqb/sJlGBJ2', 'Dr. Smith',   'instructor', 'ins12345'),
  ('alw@uconn.edu',        '$2b$10$07rtUmvgm.Zbrbv4yJKP4OTcRRopEdAIoFohQyVb6Lrqb/sJlGBJ2', 'Alice Wang',   'student',    'alw12345'),
  ('boj@uconn.edu',        '$2b$10$07rtUmvgm.Zbrbv4yJKP4OTcRRopEdAIoFohQyVb6Lrqb/sJlGBJ2', 'Bob Johnson',  'student',    'boj12345'),
  ('cal@uconn.edu',        '$2b$10$07rtUmvgm.Zbrbv4yJKP4OTcRRopEdAIoFohQyVb6Lrqb/sJlGBJ2', 'Carol Lee',    'student',    'cal12345')
ON CONFLICT (email) DO NOTHING;
