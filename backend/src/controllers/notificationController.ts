import { Response } from 'express';
import { pool } from '../db.js';
import { AppError } from '../utils/AppError.js';
import type { AuthRequest } from '../types.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';

/* ---------- helpers ---------- */

function requireUserId(req: AuthRequest): string {
  const userId = req.user?.user_id;
  if (!userId) throw new AppError(401, 'Authentication required');
  return userId;
}

/* ---------- GET /notifications ---------- */

export async function listNotifications(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

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
}

/* ---------- GET /notifications/unread-count ---------- */

export async function getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
  res.json({ count: rows[0].count });
}

/* ---------- GET /notifications/preferences ---------- */

export async function getPreferences(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const types = ['review_received', 'review_assigned', 'deadline', 'ai_complete', 'system'];
  const { rows } = await pool.query(
    `SELECT type, in_app, email, push
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );
  const byType = new Map(rows.map((r: { type: string; in_app: boolean; email: boolean; push: boolean }) => [r.type, r]));
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
}

/* ---------- PATCH /notifications/preferences ---------- */

export async function updatePreferences(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const type = String(req.body?.type || '');
  const allowed = new Set(['review_received', 'review_assigned', 'deadline', 'ai_complete', 'system']);
  if (!allowed.has(type)) {
    throw new AppError(400, 'Invalid notification type');
  }

  const hasInApp = req.body?.in_app !== undefined;
  const hasEmail = req.body?.email !== undefined;
  const hasPush = req.body?.push !== undefined;
  if (!hasInApp && !hasEmail && !hasPush) {
    throw new AppError(400, 'At least one of in_app/email/push is required');
  }

  const current = await pool.query(
    `SELECT in_app, email, push
     FROM notification_preferences
     WHERE user_id = $1 AND type = $2
     LIMIT 1`,
    [userId, type],
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
    [userId, type, nextInApp, nextEmail, nextPush],
  );

  res.json({
    ok: true,
    item: { type, in_app: nextInApp, email: nextEmail, push: nextPush },
  });
}

/* ---------- GET /notifications/push/public-key ---------- */

export async function getVapidPublicKey(_req: AuthRequest, res: Response): Promise<void> {
  if (!VAPID_PUBLIC_KEY) {
    throw new AppError(503, 'Push is not configured');
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
}

/* ---------- GET /notifications/push/subscriptions ---------- */

export async function listPushSubscriptions(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const { rows } = await pool.query(
    `SELECT endpoint, created_at, updated_at
     FROM push_subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId],
  );
  res.json(rows);
}

/* ---------- POST /notifications/push/subscriptions ---------- */

export async function createPushSubscription(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const endpoint = String(req.body?.endpoint || '').trim();
  const keys = req.body?.keys || {};
  const p256dh = String(keys.p256dh || '').trim();
  const auth = String(keys.auth || '').trim();

  if (!endpoint || !p256dh || !auth) {
    throw new AppError(400, 'endpoint, keys.p256dh and keys.auth are required');
  }

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = now()`,
    [userId, endpoint, p256dh, auth],
  );
  res.status(201).json({ ok: true });
}

/* ---------- DELETE /notifications/push/subscriptions ---------- */

export async function deletePushSubscription(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const endpoint = String(req.body?.endpoint || '').trim();
  if (endpoint) {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint],
    );
  } else {
    await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
  }
  res.json({ ok: true });
}

/* ---------- PATCH /notifications/read-all ---------- */

export async function markAllRead(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

  await pool.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
  res.json({ ok: true });
}

/* ---------- PATCH /notifications/:id/read ---------- */

export async function markOneRead(req: AuthRequest, res: Response): Promise<void> {
  const userId = requireUserId(req);

  await pool.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [req.params.id, userId],
  );
  res.json({ ok: true });
}
