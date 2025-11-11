import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/db';
import { hashSensitiveData, maskPII } from '../src/middleware/privacy';

describe('Yanxiao v2 - Assignment Visibility & Privacy', () => {
  let testUserId: string;
  let testReviewerId: string;
  let testSubmissionId: string;
  let testAssignmentId: string;
  let testInstructorId: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO users (netid, role, course_id) 
         VALUES ('test-student', 'student', 'CS101')
         RETURNING user_id`
      );
      testUserId = userResult.rows[0].user_id;

      const reviewerResult = await client.query(
        `INSERT INTO users (netid, role, course_id) 
         VALUES ('test-reviewer', 'student', 'CS101')
         RETURNING user_id`
      );
      testReviewerId = reviewerResult.rows[0].user_id;

      const instructorResult = await client.query(
        `INSERT INTO users (netid, role, course_id) 
         VALUES ('test-instructor', 'instructor', 'CS101')
         RETURNING user_id`
      );
      testInstructorId = instructorResult.rows[0].user_id;

      const submissionResult = await client.query(
        `INSERT INTO submissions (user_id, title, masked_uri) 
         VALUES ($1, 'Test Submission', 's3://test/masked.txt')
         RETURNING submission_id`,
        [testUserId]
      );
      testSubmissionId = submissionResult.rows[0].submission_id;

      const assignmentResult = await client.query(
        `INSERT INTO assignments 
         (submission_id, reviewer_id, strategy, score, cost_vector, fairness_snapshot, status) 
         VALUES ($1, $2, 'hungarian', 0.82, 
                 '{"workload":0.3,"diversity":0.4,"conflict":0.12,"total":0.82}'::jsonb,
                 '{"tpr_gap":0.06,"fpr_gap":0.05}'::jsonb,
                 'pending')
         RETURNING assignment_id`,
        [testSubmissionId, testReviewerId]
      );
      testAssignmentId = assignmentResult.rows[0].assignment_id;

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM assignments WHERE assignment_id = $1', [testAssignmentId]);
      await client.query('DELETE FROM submissions WHERE submission_id = $1', [testSubmissionId]);
      await client.query('DELETE FROM users WHERE user_id IN ($1, $2, $3)', 
        [testUserId, testReviewerId, testInstructorId]);
    } finally {
      client.release();
    }
    await pool.end();
  });

  describe('GET /assign/v1/by-submission/:id', () => {
    it('should return assignments with cost breakdown and fairness metrics', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-submission/${testSubmissionId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      expect(res.status).toBe(200);
      expect(res.body.submission_id).toBe(testSubmissionId);
      expect(res.body.assignees).toHaveLength(1);
      
      const assignee = res.body.assignees[0];
      expect(assignee.assignment_id).toBe(testAssignmentId);
      expect(assignee.strategy).toBe('hungarian');
      expect(assignee.score).toBe(0.82);
      expect(assignee.cost_breakdown).toHaveProperty('workload', 0.3);
      expect(assignee.cost_breakdown).toHaveProperty('diversity', 0.4);
      expect(assignee.cost_breakdown).toHaveProperty('conflict', 0.12);
      expect(assignee.fairness_metrics).toHaveProperty('tpr_gap', 0.06);
      expect(assignee.fairness_metrics).toHaveProperty('fpr_gap', 0.05);
    });

    it('should respect RLS - unauthorized users cannot view', async () => {
      // Create another user not related to this submission
      const client = await pool.connect();
      let otherId: string;
      try {
        const result = await client.query(
          `INSERT INTO users (netid, role, course_id) 
           VALUES ('other-user', 'student', 'CS101')
           RETURNING user_id`
        );
        otherId = result.rows[0].user_id;

        const res = await request(app)
          .get(`/assign/v1/by-submission/${testSubmissionId}`)
          .set('x-user-id', otherId)
          .set('x-user-role', 'student');

        // Should return empty array due to RLS
        expect(res.status).toBe(200);
        expect(res.body.assignees).toHaveLength(0);

        await client.query('DELETE FROM users WHERE user_id = $1', [otherId]);
      } finally {
        client.release();
      }
    });

    it('should allow instructors to view all assignments', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-submission/${testSubmissionId}`)
        .set('x-user-id', testInstructorId)
        .set('x-user-role', 'instructor');

      expect(res.status).toBe(200);
      expect(res.body.assignees).toHaveLength(1);
    });

    it('should support include_canceled query parameter', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-submission/${testSubmissionId}?include_canceled=true`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      expect(res.status).toBe(200);
      // Should still work with parameter
    });
  });

  describe('GET /assign/v1/by-reviewer/:id', () => {
    it('should return reviewer assignments with pagination', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-reviewer/${testReviewerId}?limit=10&offset=0`)
        .set('x-user-id', testReviewerId)
        .set('x-user-role', 'student');

      expect(res.status).toBe(200);
      expect(res.body.reviewer_id).toBe(testReviewerId);
      expect(res.body.assignments).toBeDefined();
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('limit', 10);
      expect(res.body.pagination).toHaveProperty('offset', 0);
      expect(res.body.pagination).toHaveProperty('has_more');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-reviewer/${testReviewerId}?status=pending`)
        .set('x-user-id', testReviewerId)
        .set('x-user-role', 'student');

      expect(res.status).toBe(200);
      res.body.assignments.forEach((a: any) => {
        expect(a.status).toBe('pending');
      });
    });

    it('should reject unauthorized access to other reviewer assignments', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-reviewer/${testReviewerId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('should allow instructors to view any reviewer', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-reviewer/${testReviewerId}`)
        .set('x-user-id', testInstructorId)
        .set('x-user-role', 'instructor');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /assign/v1/explain/:assignment_id', () => {
    it('should return detailed explanation with cost breakdown', async () => {
      const res = await request(app)
        .get(`/assign/v1/explain/${testAssignmentId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      expect(res.status).toBe(200);
      expect(res.body.assignment_id).toBe(testAssignmentId);
      expect(res.body.submission_id).toBe(testSubmissionId);
      expect(res.body.assignment.strategy).toBe('hungarian');
      expect(res.body.cost_breakdown).toHaveProperty('workload');
      expect(res.body.cost_breakdown).toHaveProperty('diversity');
      expect(res.body.cost_breakdown).toHaveProperty('conflict');
      expect(res.body.fairness_metrics).toHaveProperty('tpr_gap');
      expect(res.body.fairness_metrics).toHaveProperty('fpr_gap');
      expect(res.body.explanation).toHaveProperty('objective');
      expect(res.body.explanation).toHaveProperty('why_this_pair');
      expect(res.body.explanation).toHaveProperty('key_factors');
    });

    it('should include alternatives for instructors', async () => {
      const res = await request(app)
        .get(`/assign/v1/explain/${testAssignmentId}`)
        .set('x-user-id', testInstructorId)
        .set('x-user-role', 'instructor');

      expect(res.status).toBe(200);
      // Alternatives may be empty or present depending on data
      expect(res.body.explanation).toBeDefined();
    });

    it('should respect RLS for unauthorized users', async () => {
      const client = await pool.connect();
      let otherId: string;
      try {
        const result = await client.query(
          `INSERT INTO users (netid, role, course_id) 
           VALUES ('unauth-user', 'student', 'CS101')
           RETURNING user_id`
        );
        otherId = result.rows[0].user_id;

        const res = await request(app)
          .get(`/assign/v1/explain/${testAssignmentId}`)
          .set('x-user-id', otherId)
          .set('x-user-role', 'student');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');

        await client.query('DELETE FROM users WHERE user_id = $1', [otherId]);
      } finally {
        client.release();
      }
    });
  });

  describe('Privacy Middleware', () => {
    it('should add correlation ID to responses', async () => {
      const res = await request(app)
        .get('/healthz')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should preserve client correlation ID', async () => {
      const clientCorrelationId = '12345678-1234-1234-1234-123456789012';
      const res = await request(app)
        .get('/healthz')
        .set('x-correlation-id', clientCorrelationId)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      expect(res.headers['x-correlation-id']).toBe(clientCorrelationId);
    });

    it('should hash sensitive data correctly', () => {
      const email = 'test@example.com';
      const hash1 = hashSensitiveData(email, 'salt123');
      const hash2 = hashSensitiveData(email, 'salt123');
      
      expect(hash1).toBe(hash2); // Deterministic
      expect(hash1).toHaveLength(64); // SHA-256
      expect(hash1).not.toContain('@'); // Cannot reverse
    });

    it('should mask PII in text', () => {
      const text = 'Contact me at john.doe@example.com or call 123-456-7890';
      const masked = maskPII(text);
      
      expect(masked).not.toContain('john.doe@example.com');
      expect(masked).not.toContain('123-456-7890');
      expect(masked).toContain('j***@example.com');
      expect(masked).toContain('XXX-XXX-XXXX');
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log for assignment visibility queries', async () => {
      await request(app)
        .get(`/assign/v1/by-submission/${testSubmissionId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT * FROM audit 
           WHERE actor = $1 
           AND action = 'VIEW_ASSIGNMENTS' 
           AND entity = 'submission' 
           AND entity_id = $2
           ORDER BY created_at DESC 
           LIMIT 1`,
          [testUserId, testSubmissionId]
        );

        expect(result.rows.length).toBe(1);
        const auditLog = result.rows[0];
        expect(auditLog.hash_payload).toBeDefined();
        expect(auditLog.hash_payload).toHaveLength(64);
      } finally {
        client.release();
      }
    });

    it('should include correlation_id in audit logs', async () => {
      const correlationId = 'test-correlation-id-123';
      
      await request(app)
        .get(`/assign/v1/explain/${testAssignmentId}`)
        .set('x-correlation-id', correlationId)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT * FROM audit 
           WHERE correlation_id = $1 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [correlationId]
        );

        expect(result.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });
  });

  describe('Performance & Pagination', () => {
    it('should handle large limit values', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-reviewer/${testReviewerId}?limit=100`)
        .set('x-user-id', testReviewerId)
        .set('x-user-role', 'student');

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
    });

    it('should handle offset pagination', async () => {
      const res = await request(app)
        .get(`/assign/v1/by-reviewer/${testReviewerId}?limit=10&offset=5`)
        .set('x-user-id', testReviewerId)
        .set('x-user-role', 'student');

      expect(res.status).toBe(200);
      expect(res.body.pagination.offset).toBe(5);
    });
  });
});

describe('Database Views & Metrics', () => {
  it('should query v_adoption_rate view', async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM v_adoption_rate ORDER BY day DESC LIMIT 1`
      );
      
      // View should exist and return structured data
      if (result.rows.length > 0) {
        expect(result.rows[0]).toHaveProperty('day');
        expect(result.rows[0]).toHaveProperty('adoption_rate');
      }
    } finally {
      client.release();
    }
  });

  it('should query v_workload_variance view', async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM v_workload_variance ORDER BY day DESC LIMIT 1`
      );
      
      if (result.rows.length > 0) {
        expect(result.rows[0]).toHaveProperty('day');
        expect(result.rows[0]).toHaveProperty('workload_variance');
        expect(result.rows[0]).toHaveProperty('active_reviewers');
      }
    } finally {
      client.release();
    }
  });

  it('should query v_assignment_explain view', async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM v_assignment_explain LIMIT 1`
      );
      
      if (result.rows.length > 0) {
        expect(result.rows[0]).toHaveProperty('assignment_id');
        expect(result.rows[0]).toHaveProperty('strategy');
        expect(result.rows[0]).toHaveProperty('cost_workload');
        expect(result.rows[0]).toHaveProperty('fairness_tpr_gap');
      }
    } finally {
      client.release();
    }
  });
});
