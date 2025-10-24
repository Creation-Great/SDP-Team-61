TRUNCATE audit, ml_outputs, rewrite_suggestions, reviews, assignments, submissions, users RESTART IDENTITY CASCADE;

INSERT INTO users (user_id, netid, role, course_id, group_id) VALUES
 ('00000000-0000-0000-0000-0000000000a1','alice1','student','CSE4939W','G1'),
 ('00000000-0000-0000-0000-0000000000b1','bob1','student','CSE4939W','G1'),
 ('00000000-0000-0000-0000-0000000000c1','prof1','instructor','CSE4939W','G1');

INSERT INTO submissions (submission_id, user_id, title, raw_uri, masked_uri, hash_raw, hash_masked)
VALUES ('10000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','HW1 Draft',
        's3://bucket/raw/hw1-alice.txt','s3://bucket/masked/hw1-alice.txt',
        repeat('a',64), repeat('b',64));

INSERT INTO assignments (assignment_id, submission_id, reviewer_id, status)
VALUES ('20000000-0000-0000-0000-0000000000b1','10000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','pending');
