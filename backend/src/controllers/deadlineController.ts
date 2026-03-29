import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /deadlines/calendar
 * Returns all upcoming deadlines (peer review sessions + assignment templates) for the current user.
 */
export async function getCalendar(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;

  const events = await withDb(user_id, role, async (client) => {
    // Peer review session deadlines
    const sessions = await client.query(
      `SELECT prs.session_id AS entity_id, 'peer_review_session' AS entity_type,
              prs.title, prs.deadline, prs.course_id,
              de.extended_to
       FROM peer_review_sessions prs
       JOIN user_enrollments ue ON ue.course_id = prs.course_id AND ue.user_id = $1
       LEFT JOIN deadline_extensions de
         ON de.entity_type = 'peer_review_session'
         AND de.entity_id = prs.session_id::text
         AND de.user_id = $1
       WHERE prs.deadline >= now()
       ORDER BY prs.deadline ASC`,
      [user_id]
    );

    // Assignment template deadlines
    const templates = await client.query(
      `SELECT at.template_id AS entity_id, 'assignment_template' AS entity_type,
              at.title, at.due_date AS deadline, at.course_id,
              de.extended_to
       FROM assignment_templates at
       JOIN user_enrollments ue ON ue.course_id = at.course_id AND ue.user_id = $1
       LEFT JOIN deadline_extensions de
         ON de.entity_type = 'assignment_template'
         AND de.entity_id = at.template_id::text
         AND de.user_id = $1
       WHERE at.due_date >= now()
       ORDER BY at.due_date ASC`,
      [user_id]
    );

    return [...sessions.rows, ...templates.rows].sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    );
  });

  res.json(events);
}

/**
 * POST /deadlines/extensions
 * Body: { user_id, entity_type, entity_id, extended_to, reason? }
 */
export async function grantExtension(req: AuthRequest, res: Response): Promise<void> {
  const { user_id: grantor_id, role } = req.user;
  const { user_id: target_user_id, entity_type, entity_id, extended_to, reason } = req.body;

  if (!target_user_id || !entity_type || !entity_id || !extended_to) {
    throw new AppError(400, 'user_id, entity_type, entity_id, and extended_to are required', 'validation');
  }

  const row = await withDb(grantor_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO deadline_extensions (user_id, entity_type, entity_id, extended_to, reason, granted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
         extended_to = EXCLUDED.extended_to,
         reason = EXCLUDED.reason,
         granted_by = EXCLUDED.granted_by
       RETURNING *`,
      [target_user_id, entity_type, entity_id, extended_to, reason || null, grantor_id]
    );
    return result.rows[0];
  });

  logger.info({ target_user_id, entity_type, entity_id, extended_to }, 'Deadline extension granted');
  res.status(201).json(row);
}

/**
 * GET /deadlines/extensions?entity_type=&entity_id=
 */
export async function getExtensions(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const entityType = req.query.entity_type as string | undefined;
  const entityId = req.query.entity_id as string | undefined;

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT de.*, u.name AS user_name
       FROM deadline_extensions de
       JOIN users u ON u.user_id = de.user_id
       WHERE ($1::text IS NULL OR de.entity_type = $1)
         AND ($2::text IS NULL OR de.entity_id = $2)
       ORDER BY de.extended_to DESC`,
      [entityType || null, entityId || null]
    );
    return result.rows;
  });

  res.json(rows);
}

/**
 * POST /deadlines/reminders
 * Body: { entity_type, entity_id, reminder_hours[] }
 */
export async function configureReminders(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { entity_type, entity_id, reminder_hours } = req.body;

  if (!entity_type || !entity_id || !Array.isArray(reminder_hours)) {
    throw new AppError(400, 'entity_type, entity_id, and reminder_hours[] are required', 'validation');
  }

  const row = await withDb(user_id, role, async (client) => {
    // Delete existing reminders for this entity
    await client.query(
      `DELETE FROM deadline_reminders
       WHERE entity_type = $1 AND entity_id = $2`,
      [entity_type, entity_id]
    );

    if (reminder_hours.length === 0) {
      return [];
    }

    // Insert new reminders
    const values = reminder_hours.map((_: number, i: number) => {
      const base = i * 3;
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    }).join(', ');

    const params = reminder_hours.flatMap((h: number) => [entity_type, entity_id, h]);

    const result = await client.query(
      `INSERT INTO deadline_reminders (entity_type, entity_id, reminder_hours)
       VALUES ${values}
       RETURNING *`,
      params
    );
    return result.rows;
  });

  logger.info({ user_id, entity_type, entity_id, count: reminder_hours.length }, 'Reminders configured');
  res.json(row);
}
