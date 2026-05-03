import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * POST /quality/helpfulness
 * Body: { review_id, is_helpful }
 * Inserts or updates a helpfulness vote.
 */
export async function voteHelpfulness(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { review_id, is_helpful } = req.body;

  if (!review_id || typeof is_helpful !== 'boolean') {
    throw new AppError(400, 'review_id and is_helpful (boolean) are required', 'validation');
  }

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO review_helpfulness (review_id, voter_id, is_helpful)
       VALUES ($1, $2, $3)
       ON CONFLICT (review_id, voter_id) DO UPDATE SET is_helpful = $3
       RETURNING *`,
      [review_id, user_id, is_helpful]
    );
    return result.rows[0];
  });

  logger.info({ review_id, user_id, is_helpful }, 'Helpfulness vote recorded');
  res.json(row);
}

/**
 * GET /quality/reputation/:userId
 * Returns the reviewer_reputation row for a user.
 */
export async function getReviewerReputation(req: AuthRequest, res: Response): Promise<void> {
  const { user_id: requestor_id, role } = req.user;
  const { userId } = req.params;

  const row = await withDb(requestor_id, role, async (client) => {
    const result = await client.query(
      `SELECT user_id, total_reviews, helpful_votes, total_votes,
              helpfulness_score, consistency_score, updated_at
       FROM reviewer_reputation
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  });

  if (!row) {
    // Return zeroed-out reputation
    res.json({
      user_id: userId,
      total_reviews: 0,
      helpful_votes: 0,
      total_votes: 0,
      helpfulness_score: 0,
      consistency_score: 0,
    });
    return;
  }

  res.json(row);
}

/**
 * GET /quality/consistency?course_id=
 * Finds submissions where reviewer scores differ by more than 2 points.
 */
export async function getConsistencyAlerts(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const courseId = req.query.course_id as string | undefined;

  if (!courseId) {
    throw new AppError(400, 'course_id query parameter is required', 'validation');
  }

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT s.submission_id, s.title, s.user_id AS author_id,
              MIN(r.score) AS min_score, MAX(r.score) AS max_score,
              MAX(r.score) - MIN(r.score) AS score_range,
              COUNT(r.review_id)::int AS review_count
       FROM submissions s
       JOIN reviews r ON r.submission_id = s.submission_id
       WHERE s.course_id = $1 AND r.score IS NOT NULL
       GROUP BY s.submission_id, s.title, s.user_id
       HAVING MAX(r.score) - MIN(r.score) > 2
       ORDER BY (MAX(r.score) - MIN(r.score)) DESC`,
      [courseId]
    );
    return result.rows;
  });

  res.json(rows);
}
