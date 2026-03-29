import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { h } from '../utils/asyncHandler.js';
import type { AuthRequest } from '../types.js';
import { pool } from '../db.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

/** GET /export/:userId — Export user data (admin or self) */
router.get('/export/:userId', async (req, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  const { userId } = req.params;

  // Only admin or the user themselves can export data
  if (authReq.user.role !== 'admin' && authReq.user.user_id !== userId) {
    res.status(403).json({ error: 'forbidden', message: 'You can only export your own data' });
    return;
  }

  const [userRow, enrollments, submissions, reviews, notifications] = await Promise.all([
    pool.query('SELECT user_id, name, email, role, created_at FROM users WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM user_enrollments WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM submissions WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM reviews WHERE reviewer_id = $1', [userId]),
    pool.query('SELECT * FROM notifications WHERE user_id = $1', [userId]),
  ]);

  if (userRow.rows.length === 0) {
    res.status(404).json({ error: 'not_found', message: 'User not found' });
    return;
  }

  logger.info({ exportedBy: authReq.user.user_id, targetUserId: userId }, 'User data exported');

  res.json({
    user: userRow.rows[0],
    enrollments: enrollments.rows,
    submissions: submissions.rows,
    reviews: reviews.rows,
    notifications: notifications.rows,
    exported_at: new Date().toISOString(),
  });
});

/** POST /deletion-request — Request account data deletion (auth) */
router.post('/deletion-request', async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user.user_id;

  const { rows } = await pool.query(
    `INSERT INTO data_deletion_requests (user_id, status)
     VALUES ($1, 'pending') RETURNING *`,
    [userId]
  );

  logger.info({ userId }, 'Data deletion requested');
  res.status(201).json(rows[0]);
});

/** GET /audit — Get audit log (admin only) */
router.get('/audit', h(requireRole('admin')), async (req, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;

  const { rows } = await pool.query(
    'SELECT event_id, actor, action, entity, entity_id, meta_json, created_at FROM audit ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );

  res.json(rows);
});

export default router;
