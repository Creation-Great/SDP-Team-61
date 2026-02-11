import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import type { AuthRequest } from '../types.js';

/**
 * POST /submissions/upload
 * Student uploads a submission with a file. Automatically assigns a reviewer.
 */
export async function uploadSubmission(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { title, description } = req.body;

    if (!title) {
      res.status(400).json({ error: 'validation', message: 'Title is required' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'validation', message: 'File is required' });
      return;
    }

    const filename = req.file.filename;
    const fileUrl = `/uploads/${filename}`;

    const result = await withDb(user_id, role, async (client) => {
      // Create submission
      const sub = await client.query(
        `INSERT INTO submissions (user_id, title, description, filename, file_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING submission_id, title, description, filename, file_url, status, created_at`,
        [user_id, title, description || '', filename, fileUrl]
      );
      const submission = sub.rows[0];

      await audit(client, user_id, 'CREATE', 'submission', submission.submission_id, {
        title,
        filename,
      });

      // Auto-assign a reviewer (smart assignment algorithm)
      // Find eligible reviewers: other students, not the submitter
      const reviewerQuery = await client.query(
        `SELECT u.user_id,
                COUNT(a.assignment_id) FILTER (WHERE a.status = 'pending') AS pending_count,
                BOOL_OR(s_existing.user_id = $1) AS has_reviewed_this_student
         FROM users u
         LEFT JOIN assignments a ON a.reviewer_id = u.user_id
         LEFT JOIN submissions s_existing
           ON s_existing.submission_id = a.submission_id AND s_existing.user_id = $1
         WHERE u.user_id != $1
           AND u.role = 'student'
         GROUP BY u.user_id
         ORDER BY has_reviewed_this_student ASC NULLS FIRST, pending_count ASC
         LIMIT 1`,
        [user_id]
      );

      let assignedReviewer = null;
      if (reviewerQuery.rows.length > 0) {
        const reviewerId = reviewerQuery.rows[0].user_id;
        const assign = await client.query(
          `INSERT INTO assignments (submission_id, reviewer_id, status)
           VALUES ($1, $2, 'pending')
           RETURNING assignment_id`,
          [submission.submission_id, reviewerId]
        );

        await audit(client, user_id, 'AUTO_ASSIGN', 'assignment', assign.rows[0].assignment_id, {
          submission_id: submission.submission_id,
          reviewer_id: reviewerId,
        });

        assignedReviewer = reviewerId;
      }

      return { submission, assignedReviewer };
    });

    res.status(201).json({
      message: result.assignedReviewer
        ? 'Submission uploaded and reviewer assigned'
        : 'Submission uploaded, but no reviewers available',
      submission: result.submission,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Upload failed' });
  }
}

/**
 * GET /submissions/mine
 * Get current user's submissions with review status.
 */
export async function getMySubmissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;

    const rows = await withDb(user_id, role, async (client) => {
      const result = await client.query(
        `SELECT s.submission_id, s.title, s.description, s.filename, s.file_url,
                s.status, s.created_at,
                COALESCE(json_agg(
                  json_build_object(
                    'assignment_id', a.assignment_id,
                    'reviewer_id', a.reviewer_id,
                    'reviewer_name', u.name,
                    'assignment_status', a.status,
                    'review_id', r.review_id,
                    'score', r.score,
                    'comments', r.comments,
                    'review_created_at', r.created_at
                  )
                ) FILTER (WHERE a.assignment_id IS NOT NULL), '[]') AS reviews
         FROM submissions s
         LEFT JOIN assignments a ON a.submission_id = s.submission_id AND a.status != 'canceled'
         LEFT JOIN users u ON u.user_id = a.reviewer_id
         LEFT JOIN reviews r ON r.submission_id = s.submission_id AND r.reviewer_id = a.reviewer_id
         WHERE s.user_id = $1
         GROUP BY s.submission_id
         ORDER BY s.created_at DESC`,
        [user_id]
      );
      return result.rows;
    });

    res.json(rows);
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch submissions' });
  }
}

/**
 * GET /submissions/all
 * Instructor: get all submissions with student info.
 */
export async function getAllSubmissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;

    const rows = await withDb(user_id, role, async (client) => {
      const result = await client.query(
        `SELECT s.submission_id, s.title, s.description, s.filename, s.file_url,
                s.status, s.created_at,
                u.name AS student_name, u.email AS student_email,
                COUNT(a.assignment_id) FILTER (WHERE a.status != 'canceled') AS assigned_count,
                COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed') AS completed_count
         FROM submissions s
         JOIN users u ON u.user_id = s.user_id
         LEFT JOIN assignments a ON a.submission_id = s.submission_id
         GROUP BY s.submission_id, u.name, u.email
         ORDER BY s.created_at DESC`
      );
      return result.rows;
    });

    res.json(rows);
  } catch (err) {
    console.error('Error fetching all submissions:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch submissions' });
  }
}

/**
 * GET /submissions/reviews/my-tasks
 * Get current user's pending review assignments.
 */
export async function getMyReviewTasks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;

    const rows = await withDb(user_id, role, async (client) => {
      const result = await client.query(
        `SELECT a.assignment_id, a.submission_id, a.created_at AS assigned_at,
                s.title, s.filename, s.file_url,
                u.name AS student_name
         FROM assignments a
         JOIN submissions s ON s.submission_id = a.submission_id
         JOIN users u ON u.user_id = s.user_id
         LEFT JOIN reviews r ON r.submission_id = a.submission_id AND r.reviewer_id = a.reviewer_id
         WHERE a.reviewer_id = $1
           AND a.status = 'pending'
           AND r.review_id IS NULL
         ORDER BY a.created_at DESC`,
        [user_id]
      );
      return result.rows;
    });

    res.json(rows);
  } catch (err) {
    console.error('Error fetching review tasks:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch review tasks' });
  }
}
