import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import { pool } from '../db.js';
import type { AuthRequest } from '../types.js';
import { Response } from 'express';

const router = Router();

// All notification routes require authentication
router.use(h(authenticate));

// GET /notifications — list current user's notifications
router.get('/', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { rows } = await pool.query(
    `SELECT id, type, title, body, link, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  res.json(rows);
}));

// GET /notifications/unread-count
router.get('/unread-count', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
  res.json({ count: rows[0].count });
}));

// PATCH /notifications/read-all — mark all as read (must be before /:id to avoid param capture)
router.patch('/read-all', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

  await pool.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
  res.json({ ok: true });
}));

// PATCH /notifications/:id/read — mark one as read
router.patch('/:id/read', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

  await pool.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [req.params.id, userId],
  );
  res.json({ ok: true });
}));

export default router;
