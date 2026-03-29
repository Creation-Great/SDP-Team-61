import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { upload, validateFileContent } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { h } from '../utils/asyncHandler.js';
import { createRevisionSchema } from '../schemas.js';
import type { AuthRequest } from '../types.js';
import { pool } from '../db.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

/** POST / — Create a new revision (with file upload) */
router.post(
  '/',
  upload.single('file'),
  h(validateFileContent),
  validate(createRevisionSchema),
  async (req, res: Response) => {
    const authReq = req as unknown as AuthRequest;
    const { parent_submission_id, title, description } = authReq.body;
    const file = (req as any).file;

    if (!file) {
      res.status(400).json({ error: 'bad_request', message: 'File is required' });
      return;
    }

    // Look up parent to get revision_number and course_id
    const { rows: parentRows } = await pool.query(
      `SELECT submission_id, course_id, revision_number, assignment_template_id
       FROM submissions WHERE submission_id = $1`,
      [parent_submission_id]
    );
    if (parentRows.length === 0) {
      res.status(404).json({ error: 'not_found', message: 'Parent submission not found' });
      return;
    }
    const parent = parentRows[0];
    const newRevisionNumber = (parent.revision_number || 1) + 1;

    const { rows } = await pool.query(
      `INSERT INTO submissions (user_id, title, description, filename, file_url, course_id,
         parent_submission_id, revision_number, assignment_template_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted')
       RETURNING *`,
      [
        authReq.user.user_id, title, description || '', file.originalname,
        `/uploads/${file.filename}`, parent.course_id,
        parent_submission_id, newRevisionNumber, parent.assignment_template_id,
      ]
    );

    const newSub = rows[0];

    // Auto-assign the same reviewers from the parent
    const { rows: reviewers } = await pool.query(
      `SELECT reviewer_id FROM assignments WHERE submission_id = $1`,
      [parent_submission_id]
    );
    for (const r of reviewers) {
      await pool.query(
        `INSERT INTO assignments (submission_id, reviewer_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`,
        [newSub.submission_id, r.reviewer_id]
      );
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link, is_read)
         VALUES ($1, 'review_assigned', 'Revision submitted', 'A revised submission is ready for your review', $2, false)`,
        [r.reviewer_id, `/review/${newSub.submission_id}`]
      );
    }

    logger.info({ userId: authReq.user.user_id, submissionId: newSub.submission_id, revision: newRevisionNumber }, 'Revision created');
    res.status(201).json(newSub);
  }
);

/** GET /:submissionId/history — Get revision chain for a submission */
router.get('/:submissionId/history', async (req, res: Response) => {
  const { submissionId } = req.params;

  // Walk the revision chain via recursive CTE
  const { rows } = await pool.query(
    `WITH RECURSIVE chain AS (
       SELECT submission_id, parent_submission_id, revision_number, title, description,
              filename, file_url, status, created_at
       FROM submissions WHERE submission_id = $1
       UNION ALL
       SELECT s.submission_id, s.parent_submission_id, s.revision_number, s.title, s.description,
              s.filename, s.file_url, s.status, s.created_at
       FROM submissions s JOIN chain c ON s.submission_id = c.parent_submission_id
     )
     SELECT * FROM chain ORDER BY revision_number ASC`,
    [submissionId]
  );

  // Also get child revisions (newer versions of this submission)
  const { rows: children } = await pool.query(
    `WITH RECURSIVE fwd AS (
       SELECT submission_id, parent_submission_id, revision_number, title, description,
              filename, file_url, status, created_at
       FROM submissions WHERE parent_submission_id = $1
       UNION ALL
       SELECT s.submission_id, s.parent_submission_id, s.revision_number, s.title, s.description,
              s.filename, s.file_url, s.status, s.created_at
       FROM submissions s JOIN fwd f ON s.parent_submission_id = f.submission_id
     )
     SELECT * FROM fwd ORDER BY revision_number ASC`,
    [submissionId]
  );

  // Merge and deduplicate
  const all = [...rows, ...children];
  const seen = new Set<string>();
  const unique = all.filter(r => {
    if (seen.has(r.submission_id)) return false;
    seen.add(r.submission_id);
    return true;
  });
  unique.sort((a, b) => a.revision_number - b.revision_number);

  res.json(unique);
});

/** GET /:submissionId/diff — Compare current revision with previous */
router.get('/:submissionId/diff', async (req, res: Response) => {
  const { submissionId } = req.params;

  const { rows: current } = await pool.query(
    `SELECT submission_id, revision_number, title, description, filename, status, created_at,
            parent_submission_id
     FROM submissions WHERE submission_id = $1`,
    [submissionId]
  );
  if (current.length === 0) {
    res.status(404).json({ error: 'not_found', message: 'Submission not found' });
    return;
  }

  const cur = current[0];
  if (!cur.parent_submission_id) {
    res.json({ current: cur, previous: null, changes: [], diff_available: false });
    return;
  }

  const { rows: prevRows } = await pool.query(
    `SELECT submission_id, revision_number, title, description, filename, status, created_at
     FROM submissions WHERE submission_id = $1`,
    [cur.parent_submission_id]
  );

  const prev = prevRows[0] || null;
  const changes: string[] = [];
  if (prev) {
    if (cur.title !== prev.title) changes.push('title');
    if (cur.description !== prev.description) changes.push('description');
    if (cur.filename !== prev.filename) changes.push('file');
  }

  res.json({ current: cur, previous: prev, changes, diff_available: !!prev });
});

export default router;
