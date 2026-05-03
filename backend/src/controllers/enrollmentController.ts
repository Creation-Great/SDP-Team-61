import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import { AppError } from '../utils/AppError.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /enrollments
 * List the current user's enrollments (students see their own;
 * instructors/admins may pass ?user_id=xxx to inspect another user).
 */
export async function listEnrollments(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const targetUserId = (req.query.user_id as string) || null;

  const rows = await withDb(user_id, role, async (client) => {
    // Instructors/admins see all enrollments (or filtered by ?user_id=xxx)
    // Students only see their own
    if (role === 'instructor' || role === 'admin') {
      // Admins see all; instructors/TAs see only courses they teach
      const courseFilter = role === 'admin'
        ? null
        : (await client.query(
            `SELECT course_id FROM user_enrollments WHERE user_id = $1 AND role IN ('instructor', 'ta')`,
            [user_id]
          )).rows.map(r => r.course_id);

      if (targetUserId) {
        const r = await client.query(
          `SELECT ue.enrollment_id, ue.user_id, ue.course_id, ue.group_id,
                  ue.role, ue.is_primary, ue.enrolled_at,
                  u.name, u.email
           FROM user_enrollments ue
           JOIN users u ON u.user_id = ue.user_id
           WHERE ue.user_id = $1
             ${courseFilter ? 'AND ue.course_id = ANY($2::text[])' : ''}
           ORDER BY ue.is_primary DESC, ue.enrolled_at ASC`,
          courseFilter ? [targetUserId, courseFilter] : [targetUserId]
        );
        return r.rows;
      } else {
        const r = await client.query(
          `SELECT ue.enrollment_id, ue.user_id, ue.course_id, ue.group_id,
                  ue.role, ue.is_primary, ue.enrolled_at,
                  u.name, u.email
           FROM user_enrollments ue
           JOIN users u ON u.user_id = ue.user_id
           ${courseFilter ? 'WHERE ue.course_id = ANY($1::text[])' : ''}
           ORDER BY ue.course_id, ue.group_id NULLS LAST, u.name`,
          courseFilter ? [courseFilter] : []
        );
        return r.rows;
      }
    } else {
      const r = await client.query(
        `SELECT ue.enrollment_id, ue.user_id, ue.course_id, ue.group_id,
                ue.role, ue.is_primary, ue.enrolled_at,
                u.name, u.email
         FROM user_enrollments ue
         JOIN users u ON u.user_id = ue.user_id
         WHERE ue.user_id = $1
         ORDER BY ue.is_primary DESC, ue.enrolled_at ASC`,
        [user_id]
      );
      return r.rows;
    }
  });

  res.json(rows);
}

/**
 * POST /enrollments
 * Add an enrollment for a user. Instructor/admin only (or self-enroll if allowed).
 * Body: { user_id, course_id, group_id?, is_primary? }
 */
export async function addEnrollment(req: AuthRequest, res: Response): Promise<void> {
  const { user_id: actor, role } = req.user;
  const { user_id: targetUserId, course_id, group_id, is_primary } = req.body;

  if (!targetUserId || !course_id) {
    throw new AppError(400, 'user_id and course_id are required');
  }

  // Only instructors/admins can enroll other users
  if (role === 'student' && targetUserId !== actor) {
    throw new AppError(403, 'Students can only manage their own enrollments');
  }

  const row = await withDb(actor, role, async (client) => {
    const r = await client.query(
      `INSERT INTO user_enrollments (user_id, course_id, group_id, is_primary)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, course_id) DO UPDATE SET
         group_id   = EXCLUDED.group_id,
         is_primary = EXCLUDED.is_primary
       RETURNING *`,
      [targetUserId, course_id, group_id || null, is_primary ?? false]
    );

    await audit(client, actor, 'ENROLL', 'user_enrollment', r.rows[0].enrollment_id, {
      target_user_id: targetUserId,
      course_id,
      group_id,
    });

    return r.rows[0];
  });

  res.status(201).json(row);
}

/**
 * PATCH /enrollments/:enrollmentId
 * Update group_id or is_primary flag.
 */
export async function updateEnrollment(req: AuthRequest, res: Response): Promise<void> {
  const { user_id: actor, role } = req.user;
  const rawEnrollmentId = req.params.enrollmentId;
  const enrollmentId = Array.isArray(rawEnrollmentId) ? rawEnrollmentId[0] : rawEnrollmentId;
  const { group_id, is_primary } = req.body;

  const row = await withDb(actor, role, async (client) => {
    // Verify ownership (students) or instructor/admin
    const existing = await client.query(
      'SELECT user_id FROM user_enrollments WHERE enrollment_id = $1',
      [enrollmentId]
    );
    if (existing.rows.length === 0) {
      throw new AppError(404, 'Enrollment not found');
    }
    if (role === 'student' && existing.rows[0].user_id !== actor) {
      throw new AppError(403, 'Students can only update their own enrollments');
    }

    const setClauses: string[] = [];
    const params: (string | boolean | null)[] = [];
    let idx = 1;

    if (group_id !== undefined) {
      setClauses.push(`group_id = $${idx++}`);
      params.push(group_id);
    }
    if (is_primary !== undefined) {
      setClauses.push(`is_primary = $${idx++}`);
      params.push(is_primary);
    }

    if (setClauses.length === 0) {
      throw new AppError(400, 'Nothing to update');
    }

    params.push(enrollmentId);
    const r = await client.query(
      `UPDATE user_enrollments SET ${setClauses.join(', ')} WHERE enrollment_id = $${idx} RETURNING *`,
      params
    );

    await audit(client, actor, 'UPDATE_ENROLLMENT', 'user_enrollment', enrollmentId, {
      group_id,
      is_primary,
    });

    return r.rows[0];
  });

  res.json(row);
}

/**
 * DELETE /enrollments/:enrollmentId
 * Remove an enrollment. Instructor/admin only.
 */
export async function removeEnrollment(req: AuthRequest, res: Response): Promise<void> {
  const { user_id: actor, role } = req.user;
  const rawEnrollmentId = req.params.enrollmentId;
  const enrollmentId = Array.isArray(rawEnrollmentId) ? rawEnrollmentId[0] : rawEnrollmentId;

  if (role === 'student') {
    throw new AppError(403, 'Only instructors or admins can remove enrollments');
  }

  await withDb(actor, role, async (client) => {
    const r = await client.query(
      'DELETE FROM user_enrollments WHERE enrollment_id = $1 RETURNING *',
      [enrollmentId]
    );
    if (r.rowCount === 0) {
      throw new AppError(404, 'Enrollment not found');
    }

    await audit(client, actor, 'REMOVE_ENROLLMENT', 'user_enrollment', enrollmentId, {});
  });

  res.status(204).send();
}

/**
 * GET /enrollments/course/:courseId/members
 * List all members enrolled in a specific course. Instructor/admin only.
 */
export async function listCourseMembers(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { courseId } = req.params;
  const groupFilter = req.query.group as string | undefined;

  const rows = await withDb(user_id, role, async (client) => {
    const r = await client.query(
      `SELECT ue.enrollment_id, ue.user_id, ue.course_id, ue.group_id,
              ue.role AS enrollment_role, ue.is_primary, ue.enrolled_at,
              u.name, u.email, u.role
       FROM user_enrollments ue
       JOIN users u ON u.user_id = ue.user_id
       WHERE ue.course_id = $1
         AND ($2::text IS NULL OR ue.group_id = $2)
       ORDER BY ue.group_id NULLS LAST, u.name`,
      [courseId, groupFilter || null]
    );
    return r.rows;
  });

  res.json(rows);
}
