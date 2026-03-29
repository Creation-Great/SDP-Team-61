import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { h } from '../utils/asyncHandler.js';
import { userPreferencesSchema } from '../schemas.js';
import type { AuthRequest } from '../types.js';
import { pool } from '../db.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

/** GET / — Get current user preferences */
router.get('/', async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user.user_id;

  const { rows } = await pool.query(
    'SELECT * FROM user_preferences WHERE user_id = $1',
    [userId]
  );

  res.json(rows[0] || {
    theme: 'light',
    font_size: 'medium',
    high_contrast: false,
    preferences: {},
  });
});

/** PATCH / — Update current user preferences */
router.patch('/', validate(userPreferencesSchema), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user.user_id;
  const { theme, font_size, high_contrast, preferences } = authReq.body;

  const { rows } = await pool.query(
    `INSERT INTO user_preferences (user_id, theme, font_size, high_contrast, preferences)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       theme = COALESCE($2, user_preferences.theme),
       font_size = COALESCE($3, user_preferences.font_size),
       high_contrast = COALESCE($4, user_preferences.high_contrast),
       preferences = COALESCE($5, user_preferences.preferences),
       updated_at = now()
     RETURNING *`,
    [userId, theme || null, font_size || null, high_contrast ?? null, preferences ? JSON.stringify(preferences) : null]
  );

  logger.info({ userId }, 'User preferences updated');
  res.json(rows[0]);
});

export default router;
