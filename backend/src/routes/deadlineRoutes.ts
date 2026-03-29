import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { h } from '../utils/asyncHandler.js';
import { deadlineExtensionSchema, reminderConfigSchema } from '../schemas.js';
import type { AuthRequest } from '../types.js';
import { pool } from '../db.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

/** GET /calendar — Get all upcoming deadlines for the authenticated user */
router.get('/calendar', async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user.user_id;

  const { rows } = await pool.query(
    `SELECT prs.session_id AS entity_id, 'session' AS entity_type, prs.title, prs.deadline,
            prs.course_id
     FROM peer_review_sessions prs
     JOIN user_enrollments ue ON ue.course_id = prs.course_id AND ue.user_id = $1
     WHERE prs.deadline IS NOT NULL AND prs.deadline > now() AND prs.is_open = true
     ORDER BY prs.deadline ASC`,
    [userId]
  );

  res.json(rows);
});

/** POST /extensions — Grant a deadline extension (instructor, admin) */
router.post('/extensions', h(requireRole('instructor')), validate(deadlineExtensionSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { user_id, entity_type, entity_id, extended_to, reason } = authReq.body;

  const { rows } = await pool.query(
    `INSERT INTO deadline_extensions (user_id, entity_type, entity_id, extended_to, reason, granted_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [user_id, entity_type, entity_id, extended_to, reason || '', authReq.user.user_id]
  );

  logger.info({ grantedBy: authReq.user.user_id, userId: user_id, entityId: entity_id }, 'Deadline extension granted');
  res.status(201).json(rows[0]);
});

/** GET /extensions — List deadline extensions (auth) */
router.get('/extensions', async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const role = authReq.user.role;
  const userId = authReq.user.user_id;

  let query: string;
  let params: unknown[];

  if (role === 'instructor' || role === 'admin' || role === 'ta') {
    query = 'SELECT * FROM deadline_extensions ORDER BY created_at DESC';
    params = [];
  } else {
    query = 'SELECT * FROM deadline_extensions WHERE user_id = $1 ORDER BY created_at DESC';
    params = [userId];
  }

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

/** POST /reminders — Configure deadline reminders (instructor, admin) */
router.post('/reminders', h(requireRole('instructor')), validate(reminderConfigSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { entity_type, entity_id, reminder_hours } = authReq.body;

  // Delete existing reminders for this entity, then insert new ones
  await pool.query(
    'DELETE FROM deadline_reminders WHERE entity_type = $1 AND entity_id = $2',
    [entity_type, entity_id]
  );

  for (const hours of reminder_hours) {
    await pool.query(
      'INSERT INTO deadline_reminders (entity_type, entity_id, reminder_hours) VALUES ($1, $2, $3)',
      [entity_type, entity_id, hours]
    );
  }

  logger.info({ userId: authReq.user.user_id, entityId: entity_id, hours: reminder_hours }, 'Reminders configured');
  res.status(201).json({ message: 'Reminders configured', count: reminder_hours.length });
});

export default router;
