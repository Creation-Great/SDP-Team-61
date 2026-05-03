import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * PATCH /assignment-strategy/strategy
 * Body: { course_id, assignment_strategy, min_reviews_required? }
 */
export async function updateStrategy(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { course_id, assignment_strategy, min_reviews_required } = req.body;

  if (!course_id || !assignment_strategy) {
    throw new AppError(400, 'course_id and assignment_strategy are required', 'validation');
  }

  const validStrategies = ['random', 'load_balanced', 'reciprocal', 'manual_only'];
  if (!validStrategies.includes(assignment_strategy)) {
    throw new AppError(400, `assignment_strategy must be one of: ${validStrategies.join(', ')}`, 'validation');
  }

  // Update strategy defaults on future submissions for this course.
  // Also update any pending (unreviewed) submissions to use the new strategy.
  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `UPDATE submissions
       SET assignment_strategy = $1,
           min_reviews_required = COALESCE($2, min_reviews_required)
       WHERE course_id = $3
         AND status = 'submitted'
       RETURNING submission_id, course_id, assignment_strategy, min_reviews_required`,
      [assignment_strategy, min_reviews_required ?? null, course_id]
    );

    return {
      updated_count: result.rowCount,
      course_id,
      assignment_strategy,
      min_reviews_required: min_reviews_required ?? null,
    };
  });

  logger.info({ course_id, assignment_strategy, updated: row.updated_count }, 'Assignment strategy updated');
  res.json(row);
}

/**
 * GET /assignment-strategy/exclusions?course_id=
 * Returns review exclusions for a course.
 */
export async function getExclusions(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const courseId = req.query.course_id as string | undefined;

  if (!courseId) {
    throw new AppError(400, 'course_id query parameter is required', 'validation');
  }

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT re.id, re.course_id, re.user_a, re.user_b, re.reason, re.created_at,
              ua.name AS user_a_name, ub.name AS user_b_name
       FROM review_exclusions re
       JOIN users ua ON ua.user_id = re.user_a
       JOIN users ub ON ub.user_id = re.user_b
       WHERE re.course_id = $1
       ORDER BY re.created_at DESC`,
      [courseId]
    );
    return result.rows;
  });

  res.json(rows);
}

/**
 * POST /assignment-strategy/exclusions
 * Body: { course_id, user_a, user_b, reason? }
 */
export async function addExclusion(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { course_id, user_a, user_b, reason } = req.body;

  if (!course_id || !user_a || !user_b) {
    throw new AppError(400, 'course_id, user_a, and user_b are required', 'validation');
  }

  if (user_a === user_b) {
    throw new AppError(400, 'user_a and user_b must be different users', 'validation');
  }

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO review_exclusions (course_id, user_a, user_b, reason, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [course_id, user_a, user_b, reason || null, user_id]
    );
    return result.rows[0];
  });

  logger.info({ course_id, user_a, user_b }, 'Review exclusion added');
  res.status(201).json(row);
}

/**
 * DELETE /assignment-strategy/exclusions/:id
 */
export async function removeExclusion(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { id } = req.params;

  await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `DELETE FROM review_exclusions WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'Exclusion not found', 'not_found');
    }
  });

  logger.info({ exclusionId: id }, 'Review exclusion removed');
  res.status(204).send();
}
