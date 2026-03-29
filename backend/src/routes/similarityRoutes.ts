import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { h } from '../utils/asyncHandler.js';
import type { AuthRequest } from '../types.js';
import { pool } from '../db.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

/** GET /report/:submissionId — Get similarity reports for a submission (instructor, admin) */
router.get('/report/:submissionId', h(requireRole('instructor')), async (req, res: Response) => {
  const { submissionId } = req.params;

  const { rows } = await pool.query(
    `SELECT sr.id, sr.submission_id_a, sr.submission_id_b, sr.similarity_score,
            sr.method, sr.details, sr.created_at,
            s1.title AS title_a, s2.title AS title_b
     FROM similarity_reports sr
     JOIN submissions s1 ON s1.submission_id = sr.submission_id_a
     JOIN submissions s2 ON s2.submission_id = sr.submission_id_b
     WHERE sr.submission_id_a = $1 OR sr.submission_id_b = $1
     ORDER BY sr.similarity_score DESC`,
    [submissionId]
  );

  res.json(rows);
});

/** GET /dashboard — Get similarity dashboard overview (instructor, admin) */
router.get('/dashboard', h(requireRole('instructor')), async (req, res: Response) => {
  const courseId = req.query.course_id as string | undefined;

  let query: string;
  let params: unknown[];

  if (courseId) {
    query = `SELECT sr.id, sr.submission_id_a, sr.submission_id_b, sr.similarity_score,
                    sr.method, sr.created_at,
                    s1.title AS title_a, u1.name AS author_a,
                    s2.title AS title_b, u2.name AS author_b
             FROM similarity_reports sr
             JOIN submissions s1 ON s1.submission_id = sr.submission_id_a
             JOIN submissions s2 ON s2.submission_id = sr.submission_id_b
             JOIN users u1 ON u1.user_id = s1.user_id
             JOIN users u2 ON u2.user_id = s2.user_id
             WHERE s1.course_id = $1
             ORDER BY sr.similarity_score DESC`;
    params = [courseId];
  } else {
    query = `SELECT sr.id, sr.submission_id_a, sr.submission_id_b, sr.similarity_score,
                    sr.method, sr.created_at
             FROM similarity_reports sr
             ORDER BY sr.similarity_score DESC NULLS LAST LIMIT 100`;
    params = [];
  }

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

export default router;
