import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { h } from '../utils/asyncHandler.js';
import { pool } from '../db.js';
import type { AuthRequest } from '../types.js';
import { Response } from 'express';

const router = Router();
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';

// All notification routes require authentication
router.use(h(authenticate));

// GET /notifications — list current user's notifications
router.get('/', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }

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
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
  res.json({ count: rows[0].count });
}));

// GET /notifications/preferences
router.get('/preferences', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }

  const types = ['review_received', 'review_assigned', 'deadline', 'ai_complete', 'system'];
  const { rows } = await pool.query(
    `SELECT type, in_app, email, push
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId]
  );
  const byType = new Map(rows.map((r: any) => [r.type, r]));
  const out = types.map((type) => {
    const row = byType.get(type);
    return {
      type,
      in_app: row ? Boolean(row.in_app) : true,
      email: row ? Boolean(row.email) : false,
      push: row ? Boolean(row.push) : false,
    };
  });
  res.json(out);
}));

// PATCH /notifications/preferences
router.patch('/preferences', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }

  const type = String(req.body?.type || '');
  const allowed = new Set(['review_received', 'review_assigned', 'deadline', 'ai_complete', 'system']);
  if (!allowed.has(type)) {
    res.status(400).json({ error: 'validation', message: 'Invalid notification type' });
    return;
  }

  const hasInApp = req.body?.in_app !== undefined;
  const hasEmail = req.body?.email !== undefined;
  const hasPush = req.body?.push !== undefined;
  if (!hasInApp && !hasEmail && !hasPush) {
    res.status(400).json({ error: 'validation', message: 'At least one of in_app/email/push is required' });
    return;
  }

  const current = await pool.query(
    `SELECT in_app, email, push
     FROM notification_preferences
     WHERE user_id = $1 AND type = $2
     LIMIT 1`,
    [userId, type]
  );
  const prev = current.rows[0] || { in_app: true, email: false, push: false };
  const nextInApp = hasInApp ? Boolean(req.body.in_app) : Boolean(prev.in_app);
  const nextEmail = hasEmail ? Boolean(req.body.email) : Boolean(prev.email);
  const nextPush = hasPush ? Boolean(req.body.push) : Boolean(prev.push);

  await pool.query(
    `INSERT INTO notification_preferences (user_id, type, in_app, email, push, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id, type)
     DO UPDATE SET
       in_app = EXCLUDED.in_app,
       email = EXCLUDED.email,
       push = EXCLUDED.push,
       updated_at = now()`,
    [userId, type, nextInApp, nextEmail, nextPush]
  );

  res.json({
    ok: true,
    item: { type, in_app: nextInApp, email: nextEmail, push: nextPush },
  });
}));

// GET /notifications/push/public-key
router.get('/push/public-key', h(async (_req: AuthRequest, res: Response): Promise<void> => {
  if (!VAPID_PUBLIC_KEY) {
    res.status(503).json({ error: 'not_configured', message: 'Push is not configured' });
    return;
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
}));

// GET /notifications/push/subscriptions
router.get('/push/subscriptions', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }
  const { rows } = await pool.query(
    `SELECT endpoint, created_at, updated_at
     FROM push_subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );
  res.json(rows);
}));

// POST /notifications/push/subscriptions
router.post('/push/subscriptions', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }

  const endpoint = String(req.body?.endpoint || '').trim();
  const keys = req.body?.keys || {};
  const p256dh = String(keys.p256dh || '').trim();
  const auth = String(keys.auth || '').trim();

  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: 'validation', message: 'endpoint, keys.p256dh and keys.auth are required' });
    return;
  }

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = now()`,
    [userId, endpoint, p256dh, auth]
  );
  res.status(201).json({ ok: true });
}));

// DELETE /notifications/push/subscriptions
router.delete('/push/subscriptions', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }

  const endpoint = String(req.body?.endpoint || '').trim();
  if (endpoint) {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint]
    );
  } else {
    await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
  }
  res.json({ ok: true });
}));

// PATCH /notifications/read-all — mark all as read (must be before /:id to avoid param capture)
router.patch('/read-all', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }

  await pool.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
  res.json({ ok: true });
}));

// PATCH /notifications/:id/read — mark one as read
router.patch('/:id/read', h(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.user_id;
  if (!userId) { res.status(401).json({ error: 'unauthorized', message: 'Authentication required' }); return; }

  await pool.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [req.params.id, userId],
  );
  res.json({ ok: true });
}));

export default router;
