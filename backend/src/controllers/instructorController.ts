import { Response } from 'express';
import { withDb } from '../db.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /instructor/overview
 * Get aggregated overview for instructors (submissions, assignments, reviews by week).
 */
export async function getOverview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const course = req.query.course as string | undefined;
    const group = req.query.group as string | undefined;

    const rows = await withDb(user_id, role, async (client) => {
      // Try using materialized view if available, fall back to direct query
      try {
        const r = await client.query(
          `SELECT course_id, group_id, wk, submissions, assignments, reviews_completed
           FROM mv_instructor_cohort
           WHERE ($1::text IS NULL OR course_id = $1)
             AND ($2::text IS NULL OR group_id = $2)
           ORDER BY wk DESC`,
          [course || null, group || null]
        );
        return r.rows;
      } catch {
        // MV might not exist yet, use direct query
        const r = await client.query(
          `SELECT u.course_id, u.group_id,
                  date_trunc('week', COALESCE(a.created_at, s.created_at)) AS wk,
                  COUNT(DISTINCT s.submission_id) AS submissions,
                  COUNT(a.assignment_id) FILTER (WHERE a.status <> 'canceled') AS assignments,
                  COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed') AS reviews_completed
           FROM users u
           JOIN submissions s ON s.user_id = u.user_id
           LEFT JOIN assignments a ON a.submission_id = s.submission_id
           WHERE ($1::text IS NULL OR u.course_id = $1)
             AND ($2::text IS NULL OR u.group_id = $2)
           GROUP BY u.course_id, u.group_id, wk
           ORDER BY wk DESC`,
          [course || null, group || null]
        );
        return r.rows;
      }
    });

    res.json(rows);
  } catch (err) {
    console.error('Error fetching overview:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch overview' });
  }
}

/**
 * POST /instructor/assign
 * Instructor manually assigns a reviewer to a submission.
 */
export async function assignReviewer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { submission_id, reviewer_id } = req.body;

    if (!submission_id || !reviewer_id) {
      res.status(400).json({ error: 'validation', message: 'submission_id and reviewer_id are required' });
      return;
    }

    const result = await withDb(user_id, role, async (client) => {
      const { audit: doAudit } = await import('../utils/audit.js');

      // Try insert with ON CONFLICT
      const ins = await client.query(
        `INSERT INTO assignments (submission_id, reviewer_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT ON CONSTRAINT ux_assign_unique DO NOTHING
         RETURNING assignment_id, submission_id, reviewer_id, status, created_at`,
        [submission_id, reviewer_id]
      );

      if (ins.rowCount === 1) {
        await doAudit(client, user_id, 'ASSIGN', 'assignment', ins.rows[0].assignment_id, {
          submission_id,
          reviewer_id,
          method: 'manual',
        });
        return { code: 201, body: ins.rows[0] };
      }

      // Check if existing assignment is canceled → revive it
      const existing = await client.query(
        `SELECT assignment_id, status FROM assignments
         WHERE submission_id = $1 AND reviewer_id = $2 FOR UPDATE`,
        [submission_id, reviewer_id]
      );

      if (existing.rows.length > 0 && existing.rows[0].status === 'canceled') {
        const upd = await client.query(
          `UPDATE assignments SET status = 'pending', created_at = now()
           WHERE assignment_id = $1
           RETURNING assignment_id, submission_id, reviewer_id, status, created_at`,
          [existing.rows[0].assignment_id]
        );
        await doAudit(client, user_id, 'ASSIGN', 'assignment', upd.rows[0].assignment_id, {
          submission_id,
          reviewer_id,
          revived: true,
        });
        return { code: 201, body: upd.rows[0] };
      }

      return { code: 200, body: { note: 'already_assigned', status: existing.rows[0]?.status } };
    });

    res.status(result.code).json(result.body);
  } catch (err) {
    console.error('Error assigning reviewer:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to assign reviewer' });
  }
}
