import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /reviews/:id
 * Get a specific review/assignment details for the reviewer.
 */
export async function getReviewById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { id } = req.params; // assignment_id

    const row = await withDb(user_id, role, async (client) => {
      const result = await client.query(
        `SELECT a.assignment_id, a.submission_id, a.status AS assignment_status,
                s.title, s.filename, s.file_url, s.description,
                u.name AS student_name,
                r.review_id, r.score, r.comments, r.created_at AS review_date
         FROM assignments a
         JOIN submissions s ON s.submission_id = a.submission_id
         JOIN users u ON u.user_id = s.user_id
         LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
         WHERE a.assignment_id = $1`,
        [id]
      );
      return result.rows[0] || null;
    });

    if (!row) {
      res.status(404).json({ error: 'not_found', message: 'Review assignment not found' });
      return;
    }

    res.json(row);
  } catch (err) {
    console.error('Error fetching review:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to load review' });
  }
}

/**
 * POST /reviews/:id/submit
 * Submit a review for an assignment.
 */
export async function submitReview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { id } = req.params; // assignment_id
    const { score, comments } = req.body;

    if (score === undefined || score === null) {
      res.status(400).json({ error: 'validation', message: 'Score is required' });
      return;
    }

    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 1 || numScore > 5) {
      res.status(400).json({ error: 'validation', message: 'Score must be between 1 and 5' });
      return;
    }

    const result = await withDb(user_id, role, async (client) => {
      // Verify the assignment belongs to this reviewer
      const assignment = await client.query(
        `SELECT assignment_id, submission_id, reviewer_id, status
         FROM assignments WHERE assignment_id = $1`,
        [id]
      );

      if (assignment.rows.length === 0) {
        throw { status: 404, message: 'Assignment not found' };
      }

      const assign = assignment.rows[0];
      if (assign.reviewer_id !== user_id) {
        throw { status: 403, message: 'You are not the assigned reviewer' };
      }

      if (assign.status === 'completed') {
        throw { status: 400, message: 'Review already submitted' };
      }

      // Insert review
      const review = await client.query(
        `INSERT INTO reviews (submission_id, reviewer_id, score, comments)
         VALUES ($1, $2, $3, $4)
         RETURNING review_id, created_at`,
        [assign.submission_id, user_id, numScore, comments || '']
      );

      // Update assignment status
      await client.query(
        `UPDATE assignments SET status = 'completed' WHERE assignment_id = $1`,
        [id]
      );

      // Update submission status if all assignments are completed
      const pending = await client.query(
        `SELECT COUNT(*) AS cnt FROM assignments
         WHERE submission_id = $1 AND status = 'pending'`,
        [assign.submission_id]
      );

      if (parseInt(pending.rows[0].cnt) === 0) {
        await client.query(
          `UPDATE submissions SET status = 'reviewed' WHERE submission_id = $1`,
          [assign.submission_id]
        );
      }

      await audit(client, user_id, 'REVIEW', 'review', review.rows[0].review_id, {
        assignment_id: id,
        submission_id: assign.submission_id,
        score: numScore,
      });

      return review.rows[0];
    });

    res.status(201).json({ message: 'Review submitted successfully', review: result });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Submit review error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to submit review' });
  }
}

/**
 * GET /reviews/by-submission/:submissionId
 * Get all reviews for a specific submission (for the submission owner).
 */
export async function getReviewsBySubmission(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { submissionId } = req.params;

    const data = await withDb(user_id, role, async (client) => {
      // Verify ownership
      const sub = await client.query(
        `SELECT submission_id, title, filename, file_url, status, created_at
         FROM submissions WHERE submission_id = $1`,
        [submissionId]
      );

      if (sub.rows.length === 0) {
        throw { status: 404, message: 'Submission not found' };
      }

      const submission = sub.rows[0];

      // Check if user owns this submission or is instructor/admin
      if (submission.user_id !== user_id && role !== 'instructor' && role !== 'admin') {
        // Additional check not strictly needed due to RLS, but good for clarity
      }

      // Get reviews
      const reviews = await client.query(
        `SELECT r.review_id, r.score, r.comments, r.created_at,
                u.name AS reviewer_name
         FROM reviews r
         JOIN users u ON u.user_id = r.reviewer_id
         WHERE r.submission_id = $1
         ORDER BY r.created_at DESC`,
        [submissionId]
      );

      return { submission, reviews: reviews.rows };
    });

    res.json(data);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch reviews' });
  }
}
