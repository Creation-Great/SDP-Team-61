import type { Pool, PoolClient } from 'pg';
import type { Enrollment } from '../types.js';
import { AppError } from './AppError.js';

/**
 * Look up the group_id for a user in a specific course via user_enrollments.
 * Falls back to users.group_id if no enrollment row exists (backward compat).
 */
export async function getGroupForCourse(
  client: PoolClient,
  userId: string,
  courseId: string | null | undefined
): Promise<string | null> {
  if (!courseId) {
    // No course context — fall back to users.group_id
    const r = await client.query(
      'SELECT group_id FROM users WHERE user_id = $1',
      [userId]
    );
    return r.rows[0]?.group_id ?? null;
  }

  const r = await client.query(
    'SELECT group_id FROM user_enrollments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );

  if (r.rows.length > 0) {
    return r.rows[0].group_id;
  }

  // Fallback: users.group_id (legacy data not yet migrated)
  const fallback = await client.query(
    'SELECT group_id FROM users WHERE user_id = $1',
    [userId]
  );
  return fallback.rows[0]?.group_id ?? null;
}

/**
 * Get all enrollments for a user.
 */
export async function getEnrollments(
  client: PoolClient,
  userId: string
): Promise<Enrollment[]> {
  const r = await client.query(
    `SELECT enrollment_id, course_id, group_id, role, is_primary, enrolled_at
     FROM user_enrollments
     WHERE user_id = $1
     ORDER BY is_primary DESC, enrolled_at ASC`,
    [userId]
  );
  return r.rows;
}

/**
 * Get all teammates in the same course+group via user_enrollments.
 * If courseId is null, falls back to users.group_id matching.
 */
export async function getTeammatesByCourse(
  client: PoolClient,
  courseId: string | null | undefined,
  groupId: string | null
): Promise<Array<{ user_id: string; name: string; email: string }>> {
  if (!groupId) return [];

  if (courseId) {
    const r = await client.query(
      `SELECT u.user_id, u.name, u.email
       FROM user_enrollments ue
       JOIN users u ON u.user_id = ue.user_id
       WHERE ue.course_id = $1
         AND ue.group_id  = $2
         AND u.role = 'student'
       ORDER BY u.name`,
      [courseId, groupId]
    );

    // Fallback: if no enrollment rows, try legacy users.group_id + course_id
    if (r.rows.length === 0) {
      const fallback = await client.query(
        `SELECT user_id, name, email FROM users
         WHERE group_id = $1 AND course_id = $2 AND role = 'student'
         ORDER BY name`,
        [groupId, courseId]
      );
      return fallback.rows;
    }

    return r.rows;
  }

  // Fallback: legacy query using users.group_id
  const r = await client.query(
    `SELECT user_id, name, email FROM users
     WHERE group_id = $1 AND role = 'student'
     ORDER BY name`,
    [groupId]
  );
  return r.rows;
}

/**
 * Verify that an instructor/TA is enrolled in the given course.
 * Admins bypass this check. Throws 403 if not enrolled.
 * Works with both Pool and PoolClient.
 */
export async function verifyCourseAccess(
  db: Pool | PoolClient,
  userId: string,
  role: string,
  courseId: string
): Promise<void> {
  if (role === 'admin') return;

  const r = await db.query(
    `SELECT 1 FROM user_enrollments
     WHERE user_id = $1 AND course_id = $2 AND role IN ('instructor', 'ta')
     LIMIT 1`,
    [userId, courseId]
  );

  if (r.rows.length === 0) {
    throw new AppError(403, 'You do not have access to this course', 'forbidden');
  }
}

/**
 * Verify that a session belongs to a course the instructor teaches.
 * Admins bypass this check. Throws 403 if not authorized.
 */
export async function verifySessionAccess(
  db: Pool | PoolClient,
  userId: string,
  role: string,
  sessionId: string
): Promise<void> {
  if (role === 'admin') return;

  const r = await db.query(
    `SELECT 1 FROM peer_review_sessions prs
     WHERE prs.session_id = $1
       AND (
         prs.created_by = $2
         OR EXISTS (
           SELECT 1 FROM user_enrollments ue
           WHERE ue.course_id = prs.course_id
             AND ue.user_id = $2
             AND ue.role IN ('instructor', 'ta')
         )
       )
     LIMIT 1`,
    [sessionId, userId]
  );

  if (r.rows.length === 0) {
    throw new AppError(403, 'You do not have access to this session', 'forbidden');
  }
}
