import { Response } from 'express';
import { withDb, pool } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /grades/weights/:courseId
 */
export async function getGradeWeights(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { courseId } = req.params;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT id, course_id, file_review_weight, peer_review_weight, checkin_weight,
              drop_lowest, drop_highest, updated_at
       FROM grade_weights
       WHERE course_id = $1`,
      [courseId]
    );
    return result.rows[0] || null;
  });

  if (!row) {
    res.status(404).json({ error: 'not_found', message: 'Grade weights not configured for this course' });
    return;
  }
  res.json(row);
}

/**
 * PUT /grades/weights/:courseId
 * Body: { file_review_weight, peer_review_weight, checkin_weight, drop_lowest, drop_highest }
 */
export async function upsertGradeWeights(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { courseId } = req.params;
  const { file_review_weight, peer_review_weight, checkin_weight, drop_lowest, drop_highest } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO grade_weights (course_id, file_review_weight, peer_review_weight, checkin_weight, drop_lowest, drop_highest)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (course_id) DO UPDATE SET
         file_review_weight = EXCLUDED.file_review_weight,
         peer_review_weight = EXCLUDED.peer_review_weight,
         checkin_weight = EXCLUDED.checkin_weight,
         drop_lowest = EXCLUDED.drop_lowest,
         drop_highest = EXCLUDED.drop_highest,
         updated_at = now()
       RETURNING *`,
      [courseId, file_review_weight, peer_review_weight, checkin_weight, drop_lowest ?? 0, drop_highest ?? 0]
    );
    return result.rows[0];
  });

  logger.info({ courseId }, 'Grade weights upserted');
  res.json(row);
}

/**
 * GET /grades/final/:courseId
 * Computes final grades for all students in the course.
 */
export async function calculateFinalGrades(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { courseId } = req.params;

  const grades = await withDb(user_id, role, async (client) => {
    // Fetch weights
    const wResult = await client.query(
      `SELECT file_review_weight, peer_review_weight, checkin_weight, drop_lowest, drop_highest
       FROM grade_weights WHERE course_id = $1`,
      [courseId]
    );
    const weights = wResult.rows[0] || {
      file_review_weight: 0.4, peer_review_weight: 0.4, checkin_weight: 0.2,
      drop_lowest: 0, drop_highest: 0,
    };

    // Fetch all students in this course
    const students = await client.query(
      `SELECT ue.user_id, u.name, u.email
       FROM user_enrollments ue
       JOIN users u ON u.user_id = ue.user_id
       WHERE ue.course_id = $1 AND ue.role = 'student'`,
      [courseId]
    );

    const results = [];
    for (const student of students.rows) {
      // Average file review score
      const fileReviews = await client.query(
        `SELECT COALESCE(AVG(r.score), 0) AS avg_score
         FROM reviews r
         JOIN submissions s ON s.submission_id = r.submission_id
         WHERE s.user_id = $1 AND s.course_id = $2 AND r.score IS NOT NULL`,
        [student.user_id, courseId]
      );

      // Average peer review score
      const peerReviews = await client.query(
        `SELECT COALESCE(AVG(pr.score), 0) AS avg_score
         FROM peer_reviews pr
         WHERE pr.reviewee_id = $1 AND pr.session_id IN (
           SELECT session_id FROM peer_review_sessions WHERE course_id = $2
         ) AND pr.score IS NOT NULL`,
        [student.user_id, courseId]
      );

      // Checkin score (attendance ratio)
      const checkins = await client.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'present')::int AS present
         FROM checkins
         WHERE user_id = $1 AND course_id = $2`,
        [student.user_id, courseId]
      );

      const fileScore = parseFloat(fileReviews.rows[0].avg_score);
      const peerScore = parseFloat(peerReviews.rows[0].avg_score);
      const checkinTotal = checkins.rows[0].total || 1;
      const checkinScore = (checkins.rows[0].present / checkinTotal) * 100;

      const finalGrade =
        fileScore * weights.file_review_weight +
        peerScore * weights.peer_review_weight +
        checkinScore * weights.checkin_weight;

      results.push({
        user_id: student.user_id,
        name: student.name,
        email: student.email,
        file_review_avg: fileScore,
        peer_review_avg: peerScore,
        checkin_score: checkinScore,
        final_grade: Math.round(finalGrade * 100) / 100,
      });
    }

    return results;
  });

  res.json(grades);
}

/**
 * GET /grades/export/:courseId
 * Returns CSV download of final grades.
 */
export async function exportGradesCsv(req: AuthRequest, res: Response): Promise<void> {
  // Reuse the same calculation logic by calling the handler internally
  const { user_id, role } = req.user;
  const { courseId } = req.params;

  const grades = await withDb(user_id, role, async (client) => {
    const wResult = await client.query(
      `SELECT file_review_weight, peer_review_weight, checkin_weight
       FROM grade_weights WHERE course_id = $1`,
      [courseId]
    );
    const weights = wResult.rows[0] || {
      file_review_weight: 0.4, peer_review_weight: 0.4, checkin_weight: 0.2,
    };

    const students = await client.query(
      `SELECT ue.user_id, u.name, u.email
       FROM user_enrollments ue
       JOIN users u ON u.user_id = ue.user_id
       WHERE ue.course_id = $1 AND ue.role = 'student'`,
      [courseId]
    );

    const results = [];
    for (const student of students.rows) {
      const fileReviews = await client.query(
        `SELECT COALESCE(AVG(r.score), 0) AS avg_score
         FROM reviews r JOIN submissions s ON s.submission_id = r.submission_id
         WHERE s.user_id = $1 AND s.course_id = $2 AND r.score IS NOT NULL`,
        [student.user_id, courseId]
      );
      const peerReviews = await client.query(
        `SELECT COALESCE(AVG(pr.score), 0) AS avg_score
         FROM peer_reviews pr WHERE pr.reviewee_id = $1
         AND pr.session_id IN (SELECT session_id FROM peer_review_sessions WHERE course_id = $2)
         AND pr.score IS NOT NULL`,
        [student.user_id, courseId]
      );
      const checkins = await client.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'present')::int AS present
         FROM checkins WHERE user_id = $1 AND course_id = $2`,
        [student.user_id, courseId]
      );

      const fileScore = parseFloat(fileReviews.rows[0].avg_score);
      const peerScore = parseFloat(peerReviews.rows[0].avg_score);
      const checkinTotal = checkins.rows[0].total || 1;
      const checkinScore = (checkins.rows[0].present / checkinTotal) * 100;
      const finalGrade = fileScore * weights.file_review_weight +
        peerScore * weights.peer_review_weight +
        checkinScore * weights.checkin_weight;

      results.push({
        name: student.name, email: student.email,
        file_review_avg: fileScore, peer_review_avg: peerScore,
        checkin_score: checkinScore, final_grade: Math.round(finalGrade * 100) / 100,
      });
    }
    return results;
  });

  const header = 'Name,Email,File Review Avg,Peer Review Avg,Checkin Score,Final Grade\n';
  const rows = grades.map(g =>
    `"${g.name}","${g.email}",${g.file_review_avg},${g.peer_review_avg},${g.checkin_score},${g.final_grade}`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="grades-${courseId}.csv"`);
  res.send(header + rows);
}
