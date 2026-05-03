import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /rubrics
 * Query: rubric_type, course_id?, session_id?
 * Returns best-match rubric: session > course > global.
 */
export async function getRubric(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rubricType = String(req.query.rubric_type || '');
  const courseId = (req.query.course_id as string | undefined) || null;
  const sessionId = (req.query.session_id as string | undefined) || null;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT rubric_id, rubric_type, course_id, session_id, levels, updated_at
       FROM rubrics
       WHERE rubric_type = $1
         AND ($2::text IS NULL OR course_id IS NULL OR course_id = $2)
         AND ($3::uuid IS NULL OR session_id IS NULL OR session_id = $3::uuid)
       ORDER BY
         CASE
           WHEN session_id IS NOT NULL AND session_id = $3::uuid THEN 3
           WHEN course_id IS NOT NULL AND course_id = $2 THEN 2
           ELSE 1
         END DESC,
         updated_at DESC
       LIMIT 1`,
      [rubricType, courseId, sessionId]
    );
    return result.rows[0] || null;
  });

  if (!row) {
    res.status(404).json({ error: 'not_found', message: 'Rubric not configured' });
    return;
  }
  res.json(row);
}

/**
 * POST /instructor/rubrics
 * Upsert rubric configuration (instructor/admin).
 */
export async function upsertRubric(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { rubric_type, course_id, session_id, levels } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const existing = await client.query(
      `SELECT rubric_id
       FROM rubrics
       WHERE rubric_type = $1
         AND course_id IS NOT DISTINCT FROM $2
         AND session_id IS NOT DISTINCT FROM $3
       LIMIT 1`,
      [rubric_type, course_id || null, session_id || null]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await client.query(
        `UPDATE rubrics
         SET levels = $1::jsonb, updated_by = $2, updated_at = now()
         WHERE rubric_id = $3
         RETURNING *`,
        [JSON.stringify(levels), user_id, existing.rows[0].rubric_id]
      );
    } else {
      result = await client.query(
        `INSERT INTO rubrics (rubric_type, course_id, session_id, levels, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         RETURNING *`,
        [rubric_type, course_id || null, session_id || null, JSON.stringify(levels), user_id]
      );
    }

    await audit(client, user_id, 'UPSERT_RUBRIC', 'rubric', result.rows[0].rubric_id, {
      rubric_type,
      course_id: course_id || null,
      session_id: session_id || null,
    });

    return result.rows[0];
  });

  res.json(row);
}
