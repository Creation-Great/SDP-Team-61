import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * POST /revisions
 * Body: { parent_submission_id, title, description? }
 * File upload expected on req.file.
 * Creates a new submission with revision_number = parent.revision_number + 1.
 */
export async function createRevision(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { parent_submission_id, title, description } = req.body;

  if (!parent_submission_id || !title) {
    throw new AppError(400, 'parent_submission_id and title are required', 'validation');
  }
  if (!req.file) {
    throw new AppError(400, 'File is required', 'validation');
  }

  const uploadedFile = req.file;
  const fileUrl = `/uploads/${uploadedFile.filename}`;

  const row = await withDb(user_id, role, async (client) => {
    // Look up parent submission
    const parent = await client.query(
      `SELECT submission_id, course_id, revision_number, assignment_template_id
       FROM submissions
       WHERE submission_id = $1`,
      [parent_submission_id]
    );
    if (parent.rows.length === 0) {
      throw new AppError(404, 'Parent submission not found', 'not_found');
    }

    const p = parent.rows[0];
    const newRevisionNumber = (p.revision_number || 1) + 1;

    const result = await client.query(
      `INSERT INTO submissions (user_id, title, description, filename, file_url, course_id,
         parent_submission_id, revision_number, assignment_template_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted')
       RETURNING *`,
      [
        user_id, title, description || null, uploadedFile.originalname, fileUrl,
        p.course_id, parent_submission_id, newRevisionNumber,
        p.assignment_template_id,
      ]
    );

    const newSubmission = result.rows[0];

    // Auto-assign the same reviewers from the parent submission to this revision
    const originalReviewers = await client.query(
      `SELECT reviewer_id FROM assignments WHERE submission_id = $1`,
      [parent_submission_id]
    );

    for (const reviewer of originalReviewers.rows) {
      await client.query(
        `INSERT INTO assignments (submission_id, reviewer_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT DO NOTHING`,
        [newSubmission.submission_id, reviewer.reviewer_id]
      );

      // Create notification for reassigned reviewer
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, link, is_read)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [
          reviewer.reviewer_id,
          'review_assigned',
          'Revision submitted for your review',
          'A revision has been submitted for your review',
          `/review/${newSubmission.submission_id}`,
        ]
      );
    }

    return newSubmission;
  });

  logger.info({ submissionId: row.submission_id, revision: row.revision_number }, 'Revision created');
  res.status(201).json(row);
}

/**
 * GET /revisions/:submissionId/history
 * Returns all submissions in the revision chain.
 */
export async function getRevisionHistory(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { submissionId } = req.params;

  const rows = await withDb(user_id, role, async (client) => {
    // Walk up to find the root submission
    const root = await client.query(
      `WITH RECURSIVE chain AS (
         SELECT submission_id, parent_submission_id, revision_number, title, status, file_url, created_at
         FROM submissions WHERE submission_id = $1
         UNION ALL
         SELECT s.submission_id, s.parent_submission_id, s.revision_number, s.title, s.status, s.file_url, s.created_at
         FROM submissions s
         JOIN chain c ON s.submission_id = c.parent_submission_id
       )
       SELECT * FROM chain ORDER BY revision_number ASC`,
      [submissionId]
    );

    if (root.rows.length === 0) {
      throw new AppError(404, 'Submission not found', 'not_found');
    }

    // Also get children (later revisions)
    const rootId = root.rows[0].submission_id;
    const full = await client.query(
      `WITH RECURSIVE chain AS (
         SELECT submission_id, parent_submission_id, revision_number, title, status, file_url, created_at
         FROM submissions WHERE submission_id = $1
         UNION ALL
         SELECT s.submission_id, s.parent_submission_id, s.revision_number, s.title, s.status, s.file_url, s.created_at
         FROM submissions s
         JOIN chain c ON s.parent_submission_id = c.submission_id
       )
       SELECT * FROM chain ORDER BY revision_number ASC`,
      [rootId]
    );

    return full.rows;
  });

  res.json(rows);
}

/**
 * GET /revisions/:submissionId/diff
 * Returns metadata diff between current submission and its previous revision.
 */
export async function getRevisionDiff(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { submissionId } = req.params;

  const diff = await withDb(user_id, role, async (client) => {
    const current = await client.query(
      `SELECT submission_id, parent_submission_id, revision_number, title, description, file_url,
              filename, status, created_at
       FROM submissions WHERE submission_id = $1`,
      [submissionId]
    );
    if (current.rows.length === 0) {
      throw new AppError(404, 'Submission not found', 'not_found');
    }

    const cur = current.rows[0];
    if (!cur.parent_submission_id) {
      return { current: cur, previous: null, changes: [] };
    }

    const previous = await client.query(
      `SELECT submission_id, revision_number, title, description, file_url, filename, status, created_at
       FROM submissions WHERE submission_id = $1`,
      [cur.parent_submission_id]
    );
    const prev = previous.rows[0] || null;

    const changes: string[] = [];
    if (prev) {
      if (cur.title !== prev.title) changes.push('title');
      if (cur.description !== prev.description) changes.push('description');
      if (cur.filename !== prev.filename) changes.push('file');
    }

    return { current: cur, previous: prev, changes };
  });

  res.json(diff);
}
