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

    // Batch query: compute all scores for all students in one query using CTEs
    const gradeData = await client.query(
      `WITH file_scores AS (
         SELECT s.user_id, COALESCE(AVG(r.score), 0) AS avg_score
         FROM reviews r
         JOIN submissions s ON s.submission_id = r.submission_id
         WHERE s.course_id = $1 AND r.score IS NOT NULL
         GROUP BY s.user_id
       ),
       peer_scores AS (
         SELECT pr.reviewee_id AS user_id, COALESCE(AVG(pr.score), 0) AS avg_score
         FROM peer_reviews pr
         WHERE pr.session_id IN (
           SELECT session_id FROM peer_review_sessions WHERE course_id = $1
         ) AND pr.score IS NOT NULL
         GROUP BY pr.reviewee_id
       ),
       checkin_stats AS (
         SELECT user_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'present')::int AS present
         FROM checkins
         WHERE course_id = $1
         GROUP BY user_id
       )
       SELECT ue.user_id, u.name, u.email,
              COALESCE(fs.avg_score, 0) AS file_review_avg,
              COALESCE(ps.avg_score, 0) AS peer_review_avg,
              COALESCE(cs.total, 0)::int AS checkin_total,
              COALESCE(cs.present, 0)::int AS checkin_present
       FROM user_enrollments ue
       JOIN users u ON u.user_id = ue.user_id
       LEFT JOIN file_scores fs ON fs.user_id = ue.user_id
       LEFT JOIN peer_scores ps ON ps.user_id = ue.user_id
       LEFT JOIN checkin_stats cs ON cs.user_id = ue.user_id
       WHERE ue.course_id = $1 AND ue.role = 'student'`,
      [courseId]
    );

    const results = gradeData.rows.map(row => {
      const fileScore = parseFloat(row.file_review_avg);
      const peerScore = parseFloat(row.peer_review_avg);
      const checkinTotal = row.checkin_total || 1;
      const checkinScore = (row.checkin_present / checkinTotal) * 100;

      const finalGrade =
        fileScore * weights.file_review_weight +
        peerScore * weights.peer_review_weight +
        checkinScore * weights.checkin_weight;

      return {
        user_id: row.user_id,
        name: row.name,
        email: row.email,
        file_review_avg: fileScore,
        peer_review_avg: peerScore,
        checkin_score: checkinScore,
        final_grade: Math.round(finalGrade * 100) / 100,
      };
    });

    return results;
  });

  res.json(grades);
}

/**
 * GET /grades/export/:courseId
 * Returns CSV download of final grades. Uses the same single-query CTE pattern as
 * calculateFinalGrades to avoid the N+1 fan-out that used to run 3 queries per student.
 */
export async function exportGradesCsv(req: AuthRequest, res: Response): Promise<void> {
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

    // Single batch query: join students with their aggregated file/peer/checkin stats.
    const gradeData = await client.query(
      `WITH file_scores AS (
         SELECT s.user_id, COALESCE(AVG(r.score), 0) AS avg_score
         FROM reviews r
         JOIN submissions s ON s.submission_id = r.submission_id
         WHERE s.course_id = $1 AND r.score IS NOT NULL
         GROUP BY s.user_id
       ),
       peer_scores AS (
         SELECT pr.reviewee_id AS user_id, COALESCE(AVG(pr.score), 0) AS avg_score
         FROM peer_reviews pr
         WHERE pr.session_id IN (
           SELECT session_id FROM peer_review_sessions WHERE course_id = $1
         ) AND pr.score IS NOT NULL
         GROUP BY pr.reviewee_id
       ),
       checkin_stats AS (
         SELECT user_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'present')::int AS present
         FROM checkins
         WHERE course_id = $1
         GROUP BY user_id
       )
       SELECT ue.user_id, u.name, u.email,
              COALESCE(fs.avg_score, 0) AS file_review_avg,
              COALESCE(ps.avg_score, 0) AS peer_review_avg,
              COALESCE(cs.total, 0)::int AS checkin_total,
              COALESCE(cs.present, 0)::int AS checkin_present
       FROM user_enrollments ue
       JOIN users u ON u.user_id = ue.user_id
       LEFT JOIN file_scores fs ON fs.user_id = ue.user_id
       LEFT JOIN peer_scores ps ON ps.user_id = ue.user_id
       LEFT JOIN checkin_stats cs ON cs.user_id = ue.user_id
       WHERE ue.course_id = $1 AND ue.role = 'student'
       ORDER BY u.name`,
      [courseId]
    );

    return gradeData.rows.map((row) => {
      const fileScore = parseFloat(row.file_review_avg);
      const peerScore = parseFloat(row.peer_review_avg);
      const checkinTotal = row.checkin_total || 1;
      const checkinScore = (row.checkin_present / checkinTotal) * 100;
      const finalGrade =
        fileScore * weights.file_review_weight +
        peerScore * weights.peer_review_weight +
        checkinScore * weights.checkin_weight;

      return {
        name: row.name,
        email: row.email,
        file_review_avg: fileScore,
        peer_review_avg: peerScore,
        checkin_score: checkinScore,
        final_grade: Math.round(finalGrade * 100) / 100,
      };
    });
  });

  // Escape CSV fields: double up quotes, and prefix formula-injection characters with '
  // so spreadsheet apps don't auto-execute cells starting with = + - @ \t \r.
  const safeCsv = (val: string | number): string => {
    const s = String(val).replace(/"/g, '""');
    const sanitized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${sanitized}"`;
  };

  const header = 'Name,Email,File Review Avg,Peer Review Avg,Checkin Score,Final Grade\n';
  const rows = grades.map((g) =>
    [g.name, g.email, g.file_review_avg, g.peer_review_avg, g.checkin_score, g.final_grade]
      .map(safeCsv)
      .join(','),
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="grades-${courseId}.csv"`);
  res.send(header + rows);
}
