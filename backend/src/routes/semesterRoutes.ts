import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { h } from '../utils/asyncHandler.js';
import { createSemesterSchema, cloneCourseSchema } from '../schemas.js';
import type { AuthRequest } from '../types.js';
import { pool } from '../db.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

/** GET / — List all semesters (instructor, admin, ta) */
router.get('/', h(requireRole('instructor', 'ta')), async (req, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM semesters ORDER BY start_date DESC');
  res.json(rows);
});

/** POST / — Create a new semester (instructor, admin) */
router.post('/', h(requireRole('instructor')), validate(createSemesterSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, start_date, end_date } = authReq.body;
  const { rows } = await pool.query(
    'INSERT INTO semesters (name, start_date, end_date) VALUES ($1, $2, $3) RETURNING *',
    [name, start_date, end_date]
  );
  logger.info({ userId: authReq.user.user_id, semesterName: name }, 'Semester created');
  res.status(201).json(rows[0]);
});

/** PATCH /:id — Update a semester (instructor, admin) */
router.patch('/:id', h(requireRole('instructor')), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { id } = req.params;
  const { name, start_date, end_date } = authReq.body;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
  if (start_date !== undefined) { sets.push(`start_date = $${idx++}`); vals.push(start_date); }
  if (end_date !== undefined) { sets.push(`end_date = $${idx++}`); vals.push(end_date); }

  if (sets.length === 0) {
    res.status(400).json({ error: 'bad_request', message: 'No fields to update' });
    return;
  }

  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE semesters SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'not_found', message: 'Semester not found' });
    return;
  }

  res.json(rows[0]);
});

/** POST /clone — Clone a course into a new semester (instructor, admin) */
router.post('/clone', h(requireRole('instructor')), validate(cloneCourseSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const { source_course_id, target_course_id, semester_id } = authReq.body;

  logger.info(
    { userId: authReq.user.user_id, source_course_id, target_course_id, semester_id },
    'Course clone requested'
  );

  // Clone assignment templates from source to target
  const { rows: templates } = await pool.query(
    `INSERT INTO assignment_templates (course_id, title, description, due_at, is_active)
     SELECT $2, title, description, NULL, is_active
     FROM assignment_templates WHERE course_id = $1
     RETURNING *`,
    [source_course_id, target_course_id]
  );

  res.status(201).json({ message: 'Course cloned', templates_copied: templates.length });
});

export default router;
