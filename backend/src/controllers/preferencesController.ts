import { Response } from 'express';
import { withDb } from '../db.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /preferences
 * Returns user_preferences for the current user.
 */
export async function getPreferences(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT user_id, theme, font_size, high_contrast, preferences, updated_at
       FROM user_preferences
       WHERE user_id = $1`,
      [user_id]
    );
    return result.rows[0] || null;
  });

  // Return defaults if no preferences exist
  if (!row) {
    res.json({
      user_id,
      theme: 'light',
      font_size: 'medium',
      high_contrast: false,
      preferences: {},
    });
    return;
  }

  res.json(row);
}

/**
 * PATCH /preferences
 * Body: { theme?, font_size?, high_contrast?, preferences? }
 * Upserts user preferences.
 */
export async function updatePreferences(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { theme, font_size, high_contrast, preferences } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO user_preferences (user_id, theme, font_size, high_contrast, preferences)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         theme = COALESCE($2, user_preferences.theme),
         font_size = COALESCE($3, user_preferences.font_size),
         high_contrast = COALESCE($4, user_preferences.high_contrast),
         preferences = COALESCE($5::jsonb, user_preferences.preferences),
         updated_at = now()
       RETURNING *`,
      [
        user_id,
        theme || null,
        font_size || null,
        high_contrast ?? null,
        preferences ? JSON.stringify(preferences) : null,
      ]
    );
    return result.rows[0];
  });

  logger.info({ user_id }, 'User preferences updated');
  res.json(row);
}
