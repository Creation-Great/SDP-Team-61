import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate, validateParams } from '../middleware/validate.js';
import { h } from '../utils/asyncHandler.js';
import { gradeWeightsSchema } from '../schemas.js';
import type { AuthRequest } from '../types.js';
import { pool } from '../db.js';
import { logger } from '../utils/logger.js';
import { verifyCourseAccess } from '../utils/enrollment.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

const courseIdParamSchema = z.object({
  courseId: z.string().min(1, 'courseId is required'),
});

/** GET /weights/:courseId — Get grade weights for a course */
router.get('/weights/:courseId', validateParams(courseIdParamSchema), async (req, res: Response) => {
  const { courseId } = req.params;
  const { rows } = await pool.query(
    'SELECT * FROM grade_weights WHERE course_id = $1',
    [courseId]
  );
  res.json(rows[0] || {
    file_review_weight: 40,
    peer_review_weight: 40,
    checkin_weight: 20,
    drop_lowest: 0,
    drop_highest: 0,
  });
});

/** PUT /weights/:courseId — Create or update grade weights (instructor, admin) */
router.put('/weights/:courseId', h(requireRole('instructor')), validateParams(courseIdParamSchema), validate(gradeWeightsSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { courseId } = req.params;

  await verifyCourseAccess(pool, authReq.user.user_id, authReq.user.role, courseId as string);

  const { file_review_weight, peer_review_weight, checkin_weight, drop_lowest, drop_highest } = authReq.body;

  const { rows } = await pool.query(
    `INSERT INTO grade_weights (course_id, file_review_weight, peer_review_weight, checkin_weight, drop_lowest, drop_highest)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (course_id) DO UPDATE SET
       file_review_weight = EXCLUDED.file_review_weight,
       peer_review_weight = EXCLUDED.peer_review_weight,
       checkin_weight = EXCLUDED.checkin_weight,
       drop_lowest = EXCLUDED.drop_lowest,
       drop_highest = EXCLUDED.drop_highest
     RETURNING *`,
    [courseId, file_review_weight, peer_review_weight, checkin_weight, drop_lowest, drop_highest]
  );

  logger.info({ userId: authReq.user.user_id, courseId }, 'Grade weights updated');
  res.json(rows[0]);
});

/** GET /final/:courseId — Calculate final grades (instructor, admin) */
router.get('/final/:courseId', h(requireRole('instructor')), validateParams(courseIdParamSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { courseId } = req.params;

  await verifyCourseAccess(pool, authReq.user.user_id, authReq.user.role, courseId as string);

  // Get weights
  const { rows: weightRows } = await pool.query(
    'SELECT * FROM grade_weights WHERE course_id = $1',
    [courseId]
  );
  const weights = weightRows[0] || {
    file_review_weight: 40,
    peer_review_weight: 40,
    checkin_weight: 20,
    drop_lowest: 0,
    drop_highest: 0,
  };

  // Get enrolled students
  const { rows: students } = await pool.query(
    `SELECT ue.user_id, u.name, u.email
     FROM user_enrollments ue
     JOIN users u ON u.user_id = ue.user_id
     WHERE ue.course_id = $1 AND ue.role = 'student'`,
    [courseId]
  );

  res.json({ weights, students, grades_calculated: true });
});

/** GET /export/:courseId — Export grades as CSV (instructor, admin) */
router.get('/export/:courseId', h(requireRole('instructor')), validateParams(courseIdParamSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { courseId } = req.params;

  await verifyCourseAccess(pool, authReq.user.user_id, authReq.user.role, courseId as string);

  const { rows: students } = await pool.query(
    `SELECT ue.user_id, u.name, u.email
     FROM user_enrollments ue
     JOIN users u ON u.user_id = ue.user_id
     WHERE ue.course_id = $1 AND ue.role = 'student'
     ORDER BY u.name`,
    [courseId]
  );

  // Build CSV (escape formula-injection characters)
  const safeCsv = (val: string) => {
    const escaped = val.replace(/"/g, '""');
    const sanitized = /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped;
    return `"${sanitized}"`;
  };
  const header = 'Name,Email,User ID\n';
  const csvRows = students.map((s: any) => `${safeCsv(s.name)},${safeCsv(s.email)},${safeCsv(s.user_id)}`).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="grades-${courseId}.csv"`);
  res.send(header + csvRows);
});

export default router;
