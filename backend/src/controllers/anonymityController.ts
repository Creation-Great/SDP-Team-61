import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /anonymity/sessions/:sessionId/anonymity
 * Returns the current anonymity_level for a peer review session.
 */
export async function getAnonymityConfig(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT session_id, title, anonymity, course_id
       FROM peer_review_sessions
       WHERE session_id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'Session not found', 'not_found');
    }
    return result.rows[0];
  });

  res.json({
    session_id: row.session_id,
    title: row.title,
    anonymity: row.anonymity,
    course_id: row.course_id,
  });
}

/**
 * PATCH /anonymity/sessions/:sessionId/anonymity
 * Body: { anonymity }
 * Updates the anonymity level of a peer review session.
 */
export async function updateAnonymityConfig(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;
  const { anonymity } = req.body;

  if (!anonymity) {
    throw new AppError(400, 'anonymity is required', 'validation');
  }

  const validLevels = ['none', 'single_blind', 'double_blind'];
  if (!validLevels.includes(anonymity)) {
    throw new AppError(400, `anonymity must be one of: ${validLevels.join(', ')}`, 'validation');
  }

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `UPDATE peer_review_sessions
       SET anonymity = $1
       WHERE session_id = $2
       RETURNING session_id, title, anonymity, course_id`,
      [anonymity, sessionId]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'Session not found', 'not_found');
    }
    return result.rows[0];
  });

  logger.info({ sessionId, anonymity }, 'Anonymity config updated');
  res.json(row);
}
