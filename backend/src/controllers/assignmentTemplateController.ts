import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import { AppError } from '../utils/AppError.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /assignment-templates
 * List assignment templates. Query: course_id?, active?
 */
export async function listAssignmentTemplates(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const courseId = (req.query.course_id as string | undefined) || null;
  const activeOnly = String(req.query.active || 'true').toLowerCase() !== 'false';

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT template_id, course_id, title, description, due_at, is_active, created_at, updated_at
       FROM assignment_templates
       WHERE ($1::text IS NULL OR course_id = $1)
         AND ($2::boolean = false OR is_active = true)
       ORDER BY created_at DESC`,
      [courseId, activeOnly]
    );
    return result.rows;
  });

  res.json(rows);
}

/**
 * POST /assignment-templates
 * Instructor creates an assignment template.
 */
export async function createAssignmentTemplate(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { course_id, title, description, due_at, is_active } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO assignment_templates
         (course_id, title, description, due_at, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING template_id, course_id, title, description, due_at, is_active, created_at, updated_at`,
      [course_id, title.trim(), description || '', due_at || null, is_active ?? true, user_id]
    );
    await audit(client, user_id, 'CREATE_ASSIGNMENT_TEMPLATE', 'assignment_template', result.rows[0].template_id, {
      course_id,
      title: title.trim(),
    });
    return result.rows[0];
  });

  res.status(201).json(row);
}

/**
 * PATCH /assignment-templates/:id
 * Instructor updates template fields.
 */
export async function updateAssignmentTemplate(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { title, description, due_at, is_active } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const existing = await client.query(`SELECT template_id FROM assignment_templates WHERE template_id = $1`, [id]);
    if (existing.rows.length === 0) throw new AppError(404, 'Assignment template not found');

    const result = await client.query(
      `UPDATE assignment_templates
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           due_at = COALESCE($3, due_at),
           is_active = COALESCE($4, is_active),
           updated_at = now()
       WHERE template_id = $5
       RETURNING template_id, course_id, title, description, due_at, is_active, created_at, updated_at`,
      [title ? String(title).trim() : null, description ?? null, due_at ?? null, is_active ?? null, id]
    );

    await audit(client, user_id, 'UPDATE_ASSIGNMENT_TEMPLATE', 'assignment_template', id, {});
    return result.rows[0];
  });

  res.json(row);
}
