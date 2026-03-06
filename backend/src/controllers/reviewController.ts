import { Response } from 'express';
import { withDb, withDbNoRLS } from '../db.js';
import { recomputeAggregates } from '../utils/aggregates.js';
import { emitSseEvent } from '../utils/sse.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /me/assigned-reviews
 * All review assignments for the current user across all open weeks.
 */
export async function getAssignedReviews(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id } = req.user;

    const assignments = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT
           ra.assignment_id,
           ra.status,
           ws.full_name AS reviewee_name,
           ws.team_key,
           ra.week_id,
           w.week_number,
           w.closes_at,
           w.course_id,
           c.name AS course_name,
           (w.closes_at > now()) AS week_is_open
         FROM review_assignments ra
         JOIN week_students ws ON ws.id = ra.reviewee_week_student_id
         JOIN weeks w ON w.week_id = ra.week_id
         JOIN courses c ON c.course_id = w.course_id
         WHERE ra.reviewer_user_id = $1
         ORDER BY w.closes_at ASC, ws.full_name`,
        [user_id]
      );
      return r.rows;
    });

    res.json(assignments);
  } catch (err) {
    console.error('getAssignedReviews error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch reviews' });
  }
}

/**
 * GET /me/received-reviews
 * Anonymized received review aggregates for the current user.
 * Only returns data for closed weeks (closes_at < now()).
 */
export async function getReceivedReviews(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id } = req.user;

    const reviews = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT w.week_id, w.week_number, c.name AS course_name,
                wsa.avg_overall, wsa.per_category_json, wsa.n_reviews
         FROM week_students ws
         LEFT JOIN week_student_aggregates wsa ON wsa.reviewee_week_student_id = ws.id AND wsa.week_id = ws.week_id
         JOIN weeks w ON w.week_id = ws.week_id
         JOIN courses c ON c.course_id = w.course_id
         WHERE ws.user_id = $1
           AND w.closes_at < now()
         ORDER BY w.closes_at DESC`,
        [user_id]
      );
      return r.rows;
    });

    res.json(reviews);
  } catch (err) {
    console.error('getReceivedReviews error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch received reviews' });
  }
}

/**
 * GET /me/weeks/:weekId/assignments
 * All review assignments for current user in a specific week.
 */
export async function getWeekAssignments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id } = req.user;
    const { weekId } = req.params;

    const result = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT
           ra.assignment_id,
           ra.status,
           ws.full_name AS reviewee_name,
           ws.team_key,
           ra.week_id,
           w.week_number,
           w.closes_at,
           c.name AS course_name,
           (w.closes_at > now()) AS week_is_open
         FROM review_assignments ra
         JOIN week_students ws ON ws.id = ra.reviewee_week_student_id
         JOIN weeks w ON w.week_id = ra.week_id
         JOIN courses c ON c.course_id = w.course_id
         WHERE ra.reviewer_user_id = $1 AND ra.week_id = $2
         ORDER BY ws.full_name`,
        [user_id, weekId]
      );
      return r.rows;
    });

    res.json(result);
  } catch (err) {
    console.error('getWeekAssignments error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch assignments' });
  }
}

/**
 * GET /assignments/:assignmentId/form
 * Get the review form for a specific assignment.
 */
export async function getAssignmentForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { assignmentId } = req.params;
    const { user_id } = req.user;

    const result = await withDbNoRLS(async (client) => {
      // Get assignment details
      const raResult = await client.query(
        `SELECT ra.assignment_id, ra.status, ra.reviewer_user_id, ra.week_id,
                ra.reviewee_week_student_id,
                ws.full_name AS reviewee_name, ws.team_key
         FROM review_assignments ra
         JOIN week_students ws ON ws.id = ra.reviewee_week_student_id
         WHERE ra.assignment_id = $1`,
        [assignmentId]
      );

      if (raResult.rows.length === 0) return null;
      const ra = raResult.rows[0];

      // Verify ownership
      if (ra.reviewer_user_id !== user_id) return { forbidden: true };

      // Get categories for this week
      const catResult = await client.query(
        `SELECT label FROM week_categories WHERE week_id = $1 ORDER BY sort_order`,
        [ra.week_id]
      );

      return {
        assignment_id: ra.assignment_id,
        status: ra.status,
        reviewee_name: ra.reviewee_name,
        team_key: ra.team_key,
        categories: catResult.rows.map((r: any) => r.label),
      };
    });

    if (!result) {
      res.status(404).json({ error: 'not_found', message: 'Assignment not found' });
      return;
    }
    if ((result as any).forbidden) {
      res.status(403).json({ error: 'forbidden', message: 'Not your assignment' });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('getAssignmentForm error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch assignment form' });
  }
}

/**
 * POST /assignments/:assignmentId/submit
 * Submit a review for a specific assignment.
 * Body: { scores: { [categoryLabel]: number }, comment: string }
 */
export async function submitAssignment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { assignmentId } = req.params;
    const { scores, comment } = req.body;
    const { user_id } = req.user;

    if (!scores || typeof scores !== 'object') {
      res.status(400).json({ error: 'validation', message: 'scores object is required' });
      return;
    }

    // Validate scores 1-5
    for (const [label, score] of Object.entries(scores)) {
      const s = Number(score);
      if (!Number.isInteger(s) || s < 1 || s > 5) {
        res.status(400).json({ error: 'validation', message: `Score for "${label}" must be 1-5` });
        return;
      }
    }

    const result = await withDb(user_id, req.user.role, async (client) => {
      // Verify assignment and ownership
      const raResult = await client.query(
        `SELECT ra.assignment_id, ra.status, ra.reviewer_user_id, ra.week_id,
                ra.reviewee_week_student_id,
                ws.full_name AS reviewee_name
         FROM review_assignments ra
         JOIN week_students ws ON ws.id = ra.reviewee_week_student_id
         WHERE ra.assignment_id = $1`,
        [assignmentId]
      );

      if (raResult.rows.length === 0) {
        throw { status: 404, message: 'Assignment not found' };
      }
      const ra = raResult.rows[0];

      if (ra.reviewer_user_id !== user_id) {
        throw { status: 403, message: 'Not your assignment' };
      }
      if (ra.status === 'SUBMITTED') {
        throw { status: 400, message: 'Assignment already submitted' };
      }

      // Get category IDs for this week
      const catResult = await client.query(
        `SELECT id, label FROM week_categories WHERE week_id = $1`,
        [ra.week_id]
      );
      const categoryMap = new Map<string, string>(catResult.rows.map((r: any) => [r.label, r.id]));

      // Validate all provided scores match known categories
      for (const label of Object.keys(scores)) {
        if (!categoryMap.has(label)) {
          throw { status: 400, message: `Unknown category: "${label}"` };
        }
      }

      // Insert review_submission
      const subResult = await client.query(
        `INSERT INTO review_submissions (assignment_id, comment_text)
         VALUES ($1, $2)
         RETURNING submission_id`,
        [assignmentId, comment || '']
      );
      const submission_id = subResult.rows[0].submission_id;

      // Insert review_scores
      for (const [label, score] of Object.entries(scores)) {
        const categoryId = categoryMap.get(label)!;
        await client.query(
          `INSERT INTO review_scores (submission_id, week_category_id, score_int) VALUES ($1, $2, $3)`,
          [submission_id, categoryId, Number(score)]
        );
      }

      // Update assignment status
      await client.query(
        `UPDATE review_assignments SET status = 'SUBMITTED' WHERE assignment_id = $1`,
        [assignmentId]
      );

      // Recompute aggregates inside this transaction
      await recomputeAggregates(client, ra.week_id, ra.reviewee_week_student_id);

      return { submission_id, week_id: ra.week_id, reviewee_name: ra.reviewee_name };
    });

    // Emit SSE event
    emitSseEvent(result.week_id, 'submission_received', {
      assignment_id: assignmentId,
      reviewee_name: result.reviewee_name,
    });

    res.json({ message: 'Review submitted', submission_id: result.submission_id });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('submitAssignment error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to submit review' });
  }
}
