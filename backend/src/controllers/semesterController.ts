import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /semesters
 * Returns all semesters ordered by start_date DESC.
 */
export async function listSemesters(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT semester_id, name, start_date, end_date, is_active, created_at, updated_at
       FROM semesters
       ORDER BY start_date DESC`
    );
    return result.rows;
  });

  res.json(rows);
}

/**
 * POST /semesters
 * Body: { name, start_date, end_date }
 */
export async function createSemester(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { name, start_date, end_date } = req.body;

  if (!name || !start_date || !end_date) {
    throw new AppError(400, 'name, start_date, and end_date are required', 'validation');
  }

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO semesters (name, start_date, end_date)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, start_date, end_date]
    );
    return result.rows[0];
  });

  logger.info({ semesterId: row.semester_id }, 'Semester created');
  res.status(201).json(row);
}

/**
 * PATCH /semesters/:id
 * Body: { name?, start_date?, end_date?, is_active? }
 */
export async function updateSemester(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { id } = req.params;
  const { name, start_date, end_date, is_active } = req.body;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(name); }
  if (start_date !== undefined) { setClauses.push(`start_date = $${idx++}`); values.push(start_date); }
  if (end_date !== undefined) { setClauses.push(`end_date = $${idx++}`); values.push(end_date); }
  if (is_active !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(is_active); }

  if (setClauses.length === 0) {
    throw new AppError(400, 'No fields to update', 'validation');
  }

  setClauses.push(`updated_at = now()`);
  values.push(id);

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `UPDATE semesters SET ${setClauses.join(', ')} WHERE semester_id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) throw new AppError(404, 'Semester not found', 'not_found');
    return result.rows[0];
  });

  res.json(row);
}

/**
 * POST /semesters/clone
 * Body: { source_course_id, target_course_id, semester_id? }
 * Copies rubrics, assignment_templates, and submission_policies from one course to another.
 */
export async function cloneCourse(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { source_course_id, target_course_id, semester_id } = req.body;

  if (!source_course_id || !target_course_id) {
    throw new AppError(400, 'source_course_id and target_course_id are required', 'validation');
  }

  const summary = await withDb(user_id, role, async (client) => {
    // Clone rubrics
    const rubrics = await client.query(
      `INSERT INTO rubrics (rubric_type, course_id, session_id, levels, updated_by)
       SELECT rubric_type, $2, NULL, levels, $3
       FROM rubrics
       WHERE course_id = $1
       RETURNING rubric_id`,
      [source_course_id, target_course_id, user_id]
    );

    // Clone assignment templates
    const templates = await client.query(
      `INSERT INTO assignment_templates (course_id, title, description, max_file_size_mb, allowed_formats, reviewer_count, semester_id)
       SELECT $2, title, description, max_file_size_mb, allowed_formats, reviewer_count, COALESCE($3, semester_id)
       FROM assignment_templates
       WHERE course_id = $1
       RETURNING template_id`,
      [source_course_id, target_course_id, semester_id || null]
    );

    // Clone submission policies
    const policies = await client.query(
      `INSERT INTO submission_policies (course_id, late_policy, grace_period_hours, max_submissions, allow_edit_withdraw_after_reviews)
       SELECT $2, late_policy, grace_period_hours, max_submissions, allow_edit_withdraw_after_reviews
       FROM submission_policies
       WHERE course_id = $1
       ON CONFLICT (course_id) DO UPDATE SET
         late_policy = EXCLUDED.late_policy,
         grace_period_hours = EXCLUDED.grace_period_hours,
         max_submissions = EXCLUDED.max_submissions,
         allow_edit_withdraw_after_reviews = EXCLUDED.allow_edit_withdraw_after_reviews
       RETURNING course_id`,
      [source_course_id, target_course_id]
    );

    return {
      rubrics_cloned: rubrics.rowCount,
      templates_cloned: templates.rowCount,
      policies_cloned: policies.rowCount,
    };
  });

  logger.info({ source_course_id, target_course_id }, 'Course cloned');
  res.status(201).json(summary);
}
