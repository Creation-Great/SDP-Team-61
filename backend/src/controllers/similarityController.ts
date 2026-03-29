import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /similarity/report/:submissionId
 * Returns similarity_reports for a specific submission.
 */
export async function getSimilarityReport(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { submissionId } = req.params;

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT sr.id, sr.submission_id_a, sr.submission_id_b,
              sr.similarity_score, sr.method, sr.details, sr.created_at,
              s1.title AS title_a,
              s2.title AS title_b
       FROM similarity_reports sr
       JOIN submissions s1 ON s1.submission_id = sr.submission_id_a
       LEFT JOIN submissions s2 ON s2.submission_id = sr.submission_id_b
       WHERE sr.submission_id_a = $1 OR sr.submission_id_b = $1
       ORDER BY sr.similarity_score DESC`,
      [submissionId]
    );

    if (result.rows.length === 0) {
      const sub = await client.query(
        `SELECT submission_id FROM submissions WHERE submission_id = $1`, [submissionId]
      );
      if (sub.rows.length === 0) {
        throw new AppError(404, 'Submission not found', 'not_found');
      }
    }

    return result.rows;
  });

  res.json(rows);
}

/**
 * GET /similarity/dashboard?course_id=
 * Returns all similarity reports for a course.
 */
export async function getSimilarityDashboard(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const courseId = req.query.course_id as string | undefined;

  if (!courseId) {
    throw new AppError(400, 'course_id query parameter is required', 'validation');
  }

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT sr.id, sr.submission_id_a, sr.submission_id_b,
              sr.similarity_score, sr.method, sr.created_at,
              s1.title AS title_a, s1.user_id AS author_a_id,
              u1.name AS author_a_name,
              s2.title AS title_b, s2.user_id AS author_b_id,
              u2.name AS author_b_name
       FROM similarity_reports sr
       JOIN submissions s1 ON s1.submission_id = sr.submission_id_a
       JOIN submissions s2 ON s2.submission_id = sr.submission_id_b
       JOIN users u1 ON u1.user_id = s1.user_id
       JOIN users u2 ON u2.user_id = s2.user_id
       WHERE s1.course_id = $1
       ORDER BY sr.similarity_score DESC`,
      [courseId]
    );
    return result.rows;
  });

  res.json(rows);
}
