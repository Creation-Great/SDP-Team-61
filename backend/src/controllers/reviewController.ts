import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import { AppError } from '../utils/AppError.js';
import { scheduleMvRefresh } from '../utils/mvRefresh.js';
import { emitSseEvent } from '../utils/sse.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /reviews/:id
 * Get a specific review/assignment details for the reviewer.
 */
export async function getReviewById(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { id } = req.params; // assignment_id

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT a.assignment_id, a.submission_id, a.reviewer_id,
              a.status AS assignment_status,
              s.title, s.filename, s.file_url, s.description,
              s.user_id AS submission_owner_id,
              u.name AS student_name,
              r.review_id, r.score, r.comments, r.created_at AS review_date
       FROM assignments a
       JOIN submissions s ON s.submission_id = a.submission_id
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
       WHERE a.assignment_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, 'Review assignment not found');
    }

    const row = result.rows[0];

    // Only the assigned reviewer, the submission owner, or instructor/admin may view
    const isReviewer = row.reviewer_id === user_id;
    const isOwner = row.submission_owner_id === user_id;
    const isPrivileged = role === 'instructor' || role === 'admin';
    if (!isReviewer && !isOwner && !isPrivileged) {
      throw new AppError(403, 'You do not have permission to view this review assignment');
    }

    // Strip internal id before returning
    const { reviewer_id: _rid, submission_owner_id: _soid, ...safe } = row;
    return safe;
  });

  res.json(row);
}

/**
 * POST /reviews/:id/submit
 * Submit a review for an assignment.
 */
export async function submitReview(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { id } = req.params; // assignment_id
  const { score, comments } = req.body;

  const numScore = Number(score);

  const result = await withDb(user_id, role, async (client) => {
    // Verify the assignment belongs to this reviewer
    const assignment = await client.query(
      `SELECT assignment_id, submission_id, reviewer_id, status
       FROM assignments WHERE assignment_id = $1`,
      [id]
    );

    if (assignment.rows.length === 0) {
      throw new AppError(404, 'Assignment not found');
    }

    const assign = assignment.rows[0];
    if (assign.reviewer_id !== user_id) {
      throw new AppError(403, 'You are not the assigned reviewer');
    }

    if (assign.status === 'completed') {
      throw new AppError(400, 'Review already submitted');
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

  scheduleMvRefresh();

  // Emit SSE event for real-time instructor dashboard
  const sseChannel = req.user.course_id ? `course:${req.user.course_id}` : `instructor:global`;
  emitSseEvent(sseChannel, 'review_submitted', {
    review_id: result.review_id,
    assignment_id: id,
    reviewer_name: req.user.name,
  });

  res.status(201).json({ message: 'Review submitted successfully', review: result });
}

/**
 * GET /reviews/by-submission/:submissionId
 * Get all reviews for a specific submission (for the submission owner).
 */
export async function getReviewsBySubmission(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { submissionId } = req.params;

  const data = await withDb(user_id, role, async (client) => {
    // Verify ownership
    const sub = await client.query(
      `SELECT submission_id, user_id, title, filename, file_url, status, created_at
       FROM submissions WHERE submission_id = $1`,
      [submissionId]
    );

    if (sub.rows.length === 0) {
      throw new AppError(404, 'Submission not found');
    }

    const submission = sub.rows[0];

    // Only the submission owner or instructor/admin may view reviews
    if (submission.user_id !== user_id && role !== 'instructor' && role !== 'admin') {
      throw new AppError(403, 'You do not have permission to view reviews for this submission');
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
}
