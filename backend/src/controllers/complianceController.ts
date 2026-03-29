import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /compliance/export/:userId
 * Collects all user data into JSON and returns as a downloadable file.
 * Covers: profile, submissions, reviews, peer_reviews, notifications, ai_conversations.
 */
export async function exportUserData(req: AuthRequest, res: Response): Promise<void> {
  const { user_id: requestor_id, role } = req.user;
  const { userId } = req.params;

  // Only admins or the user themselves can export
  if (role !== 'admin' && requestor_id !== userId) {
    throw new AppError(403, 'You can only export your own data', 'forbidden');
  }

  const data = await withDb(requestor_id, role, async (client) => {
    const profile = await client.query(
      `SELECT user_id, email, name, role, created_at FROM users WHERE user_id = $1`,
      [userId]
    );
    if (profile.rows.length === 0) {
      throw new AppError(404, 'User not found', 'not_found');
    }

    const submissions = await client.query(
      `SELECT submission_id, title, description, file_url, status, course_id, created_at
       FROM submissions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const reviews = await client.query(
      `SELECT review_id, submission_id, score, comments, created_at
       FROM reviews WHERE reviewer_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const peerReviews = await client.query(
      `SELECT peer_review_id, session_id, reviewer_id, reviewee_id,
              technical_contributions, team_interactions, project_management,
              individual_comments, created_at
       FROM peer_reviews WHERE reviewer_id = $1 OR reviewee_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const notifications = await client.query(
      `SELECT id, type, title, body, is_read, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const aiActivity = await client.query(
      `SELECT id, action, detail, created_at
       FROM ai_activity_logs WHERE user_id = $1::text ORDER BY created_at DESC`,
      [userId]
    );

    return {
      exported_at: new Date().toISOString(),
      profile: profile.rows[0],
      submissions: submissions.rows,
      reviews: reviews.rows,
      peer_reviews: peerReviews.rows,
      notifications: notifications.rows,
      ai_activity: aiActivity.rows,
    };
  });

  const jsonStr = JSON.stringify(data, null, 2);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.json"`);
  res.send(jsonStr);
}

/**
 * POST /compliance/deletion-request
 * Creates a data_deletion_requests entry.
 */
export async function requestDeletion(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO data_deletion_requests (user_id, status)
       VALUES ($1, 'pending')
       RETURNING *`,
      [user_id]
    );
    return result.rows[0];
  });

  logger.info({ user_id, requestId: row.request_id }, 'Data deletion requested');
  res.status(201).json(row);
}

/**
 * GET /compliance/audit?page=1&pageSize=50
 * Returns audit table entries with pagination.
 */
export async function getAuditLog(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 50));
  const offset = (page - 1) * pageSize;

  if (role !== 'admin' && role !== 'instructor') {
    throw new AppError(403, 'Only admins and instructors can view audit logs', 'forbidden');
  }

  const result = await withDb(user_id, role, async (client) => {
    const countResult = await client.query(`SELECT COUNT(*)::int AS total FROM audit`);
    const total = countResult.rows[0].total;

    const rows = await client.query(
      `SELECT a.event_id, a.actor, a.action, a.entity, a.entity_id, a.meta_json, a.created_at,
              u.name AS user_name
       FROM audit a
       LEFT JOIN users u ON u.user_id = a.actor
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return {
      data: rows.rows,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  });

  res.json(result);
}
