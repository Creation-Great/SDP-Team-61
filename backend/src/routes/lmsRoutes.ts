import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { h } from '../utils/asyncHandler.js';
import { lmsConfigSchema } from '../schemas.js';
import type { AuthRequest } from '../types.js';
import { pool } from '../db.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

/** GET /:courseId — Get LMS configuration for a course (instructor, admin) */
router.get('/:courseId', h(requireRole('instructor')), async (req, res: Response) => {
  const { courseId } = req.params;
  const { rows } = await pool.query(
    'SELECT * FROM lms_config WHERE course_id = $1',
    [courseId]
  );
  res.json(rows[0] || null);
});

/** PUT /:courseId — Create or update LMS configuration (instructor, admin) */
router.put('/:courseId', h(requireRole('instructor')), validate(lmsConfigSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { courseId } = req.params;
  const { provider, api_url, api_key, config_json } = authReq.body;

  const { rows } = await pool.query(
    `INSERT INTO lms_config (course_id, provider, api_url, api_key, config_json)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (course_id) DO UPDATE SET
       provider = EXCLUDED.provider,
       api_url = EXCLUDED.api_url,
       api_key = EXCLUDED.api_key,
       config_json = EXCLUDED.config_json,
       updated_at = now()
     RETURNING *`,
    [courseId, provider, api_url || null, api_key || null, config_json ? JSON.stringify(config_json) : null]
  );

  logger.info({ userId: authReq.user.user_id, courseId, provider }, 'LMS config updated');
  res.json(rows[0]);
});

/** POST /lti/launch — Mock LTI launch (instructor, admin) */
router.post('/lti/launch', h(requireRole('instructor')), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  logger.info({ userId: authReq.user.user_id }, 'Mock LTI launch triggered');
  res.json({ success: true, message: 'Mock LTI launch completed', launch_id: crypto.randomUUID() });
});

/** POST /lti/grades — Mock grade passback (instructor, admin) */
router.post('/lti/grades', h(requireRole('instructor')), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  logger.info({ userId: authReq.user.user_id }, 'Mock grade passback triggered');
  res.json({ success: true, message: 'Mock grade passback completed' });
});

/** POST /lti/roster — Mock roster import (instructor, admin) */
router.post('/lti/roster', h(requireRole('instructor')), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  logger.info({ userId: authReq.user.user_id }, 'Mock roster import triggered');
  res.json({ success: true, message: 'Mock roster import completed', students_imported: 0 });
});

export default router;
