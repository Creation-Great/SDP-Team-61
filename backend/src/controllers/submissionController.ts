import { Response } from 'express';
import fs from 'fs';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import { AppError } from '../utils/AppError.js';
import { scheduleMvRefresh } from '../utils/mvRefresh.js';
import { getGroupForCourse } from '../utils/enrollment.js';
import { emitSseEvent } from '../utils/sse.js';
import { createNotification } from '../utils/notifications.js';
import type { AuthRequest } from '../types.js';

/** Default reviewer count if not specified (zod schema enforces 1–3 range) */
const DEFAULT_REVIEWERS = 1;

async function canEditOrWithdraw(client: import('pg').PoolClient, submissionId: string, courseId: string | null): Promise<boolean> {
  const reviews = await client.query(
    `SELECT COUNT(*)::int AS cnt FROM reviews WHERE submission_id = $1`,
    [submissionId]
  );
  if (Number(reviews.rows[0].cnt) === 0) return true;

  const policy = await client.query(
    `SELECT allow_edit_withdraw_after_reviews
     FROM submission_policies
     WHERE course_id = $1
     LIMIT 1`,
    [courseId]
  );
  return Boolean(policy.rows[0]?.allow_edit_withdraw_after_reviews);
}

/**
 * POST /submissions/upload
 * Student uploads a submission with a file. Automatically assigns reviewers.
 * Body may include `reviewerCount` (1–3, default 1).
 */
export async function uploadSubmission(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id, group_id } = req.user;
  const { title, description, reviewerCount, course_id: requestedCourseId, assignment_template_id } = req.body;

  if (!req.file) {
    res.status(400).json({ error: 'validation', message: 'File is required' });
    return;
  }

  const safeReviewerCount = reviewerCount ?? DEFAULT_REVIEWERS;

  const filename = req.file.filename;
  const fileUrl = `/uploads/${filename}`;

  const result = await withDb(user_id, role, async (client) => {
    let effectiveCourseId: string | null = requestedCourseId || course_id || null;
    let effectiveGroupId: string | null = group_id || null;
    if (requestedCourseId) {
      const enrollment = await client.query(
        `SELECT course_id, group_id
         FROM user_enrollments
         WHERE user_id = $1 AND course_id = $2
         LIMIT 1`,
        [user_id, requestedCourseId]
      );
      if (enrollment.rows.length === 0) {
        throw new AppError(403, 'You are not enrolled in the selected course');
      }
      effectiveCourseId = enrollment.rows[0].course_id;
      effectiveGroupId = enrollment.rows[0].group_id ?? null;
    }

    // Create submission
    let templateId: string | null = assignment_template_id || null;
    if (templateId) {
      const tpl = await client.query(
        `SELECT template_id, course_id, is_active
         FROM assignment_templates
         WHERE template_id = $1
         LIMIT 1`,
        [templateId]
      );
      if (tpl.rows.length === 0) throw new AppError(404, 'Assignment template not found');
      if (!tpl.rows[0].is_active) throw new AppError(400, 'Assignment template is inactive');
      if ((tpl.rows[0].course_id || null) !== (effectiveCourseId || null)) {
        throw new AppError(400, 'Assignment template does not belong to selected course');
      }
    }

    const sub = await client.query(
      `INSERT INTO submissions (user_id, course_id, assignment_template_id, title, description, filename, file_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING submission_id, course_id, assignment_template_id, title, description, filename, file_url, status, created_at`,
      [user_id, effectiveCourseId, templateId, title, description || '', filename, fileUrl]
    );
    const submission = sub.rows[0];

    await audit(client, user_id, 'CREATE', 'submission', submission.submission_id, {
      title,
      filename,
    });

    // ---- Auto-assign reviewers (strategy-aware, course-isolated) ----
    const assignmentStrategy = req.body.assignment_strategy || 'random';
    const minReviewsRequired = req.body.min_reviews_required || safeReviewerCount;

    // If manual_only strategy, skip auto-assign entirely
    const assignedReviewers: string[] = [];
    if (assignmentStrategy === 'manual_only') {
      return { submission, assignedReviewers };
    }

    // Query review exclusions for this course
    const exclusionResult = effectiveCourseId
      ? await client.query(
          `SELECT user_a, user_b FROM review_exclusions WHERE course_id = $1`,
          [effectiveCourseId]
        )
      : { rows: [] };
    const excludedPairs = new Set<string>();
    for (const ex of exclusionResult.rows) {
      excludedPairs.add(`${ex.user_a}:${ex.user_b}`);
      excludedPairs.add(`${ex.user_b}:${ex.user_a}`);
    }

    // Build ORDER BY clause based on strategy
    let orderClause = 'same_group ASC, pending_count ASC'; // default random/load_balanced
    if (assignmentStrategy === 'load_balanced') {
      orderClause = 'pending_count ASC, same_group ASC';
    } else if (assignmentStrategy === 'reciprocal') {
      orderClause = 'has_unreviewed_submission DESC, pending_count ASC, same_group ASC';
    }

    const reviewerQuery = await client.query(
      `SELECT u.user_id,
              COUNT(a.assignment_id) FILTER (WHERE a.status = 'pending') AS pending_count,
              CASE WHEN COALESCE(ue.group_id, u.group_id) = $3 THEN 1 ELSE 0 END AS same_group,
              CASE WHEN EXISTS (
                SELECT 1 FROM submissions s2
                WHERE s2.user_id = u.user_id AND s2.course_id = $2
                  AND NOT EXISTS (
                    SELECT 1 FROM reviews r2
                    WHERE r2.submission_id = s2.submission_id AND r2.reviewer_id = $1
                  )
              ) THEN 1 ELSE 0 END AS has_unreviewed_submission
       FROM users u
       LEFT JOIN user_enrollments ue ON ue.user_id = u.user_id AND ue.course_id = $2
       LEFT JOIN assignments a ON a.reviewer_id = u.user_id
       WHERE u.user_id != $1
         AND u.role   = 'student'
         AND COALESCE(ue.course_id, u.course_id) IS NOT DISTINCT FROM $2
       GROUP BY u.user_id, COALESCE(ue.group_id, u.group_id)
       ORDER BY ${orderClause}
       LIMIT $4`,
      [user_id, effectiveCourseId, effectiveGroupId, minReviewsRequired]
    );

    for (const row of reviewerQuery.rows) {
      // Filter out excluded pairs
      if (excludedPairs.has(`${user_id}:${row.user_id}`)) continue;
      const assign = await client.query(
        `INSERT INTO assignments (submission_id, reviewer_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING assignment_id`,
        [submission.submission_id, row.user_id]
      );

      await audit(client, user_id, 'AUTO_ASSIGN', 'assignment', assign.rows[0].assignment_id, {
        submission_id: submission.submission_id,
        reviewer_id: row.user_id,
      });
      await createNotification(client, {
        userId: row.user_id,
        type: 'review_assigned',
        title: 'New review assignment',
        body: `You have been assigned to review "${submission.title}".`,
        link: '/assigned-reviews',
      });

      assignedReviewers.push(row.user_id);
    }

    return { submission, assignedReviewers };
  });

  scheduleMvRefresh();

  // Emit SSE event for real-time instructor dashboard
  const sseChannel = result.submission.course_id ? `course:${result.submission.course_id}` : (course_id ? `course:${course_id}` : 'instructor:global');
  emitSseEvent(sseChannel, 'submission_created', {
    submission_id: result.submission.submission_id,
    title: result.submission.title,
    student_name: req.user.name,
    assigned_reviewers: result.assignedReviewers.length,
  });

  const count = result.assignedReviewers.length;
  res.status(201).json({
    message:
      count > 0
        ? `Submission uploaded and ${count} reviewer(s) assigned`
        : 'Submission uploaded, but no reviewers available',
    submission: result.submission,
    assignedReviewerCount: count,
  });
}

/**
 * GET /submissions/mine
 * Get current user's submissions with review status.
 */
export async function getMySubmissions(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT s.submission_id, s.course_id, s.title, s.description, s.filename, s.file_url,
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
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * GET /submissions/all
 * Instructor: get all submissions with student info.
 * Query: page (default 1), pageSize (default 50, max 100). When omitted, returns all (backward compatible).
 * Response: { submissions, total } when page/pageSize present; otherwise array (legacy) for compatibility.
 */
export async function getAllSubmissions(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const rawSize = parseInt(String(req.query.pageSize || '0'), 10) || 0;
  const pageSize = rawSize <= 0 ? 0 : Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  const usePagination = pageSize > 0;
  const course = req.query.course as string | undefined;
  const group = req.query.group as string | undefined;
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;

  const { rows, total } = await withDb(user_id, role, async (client) => {
    const baseWhere = `WHERE ($1::text IS NULL OR COALESCE(s.course_id, u.course_id) = $1)
                       AND ($2::text IS NULL OR u.group_id = $2)
                       AND ($3::timestamptz IS NULL OR s.created_at >= $3::timestamptz)
                       AND ($4::timestamptz IS NULL OR s.created_at <= $4::timestamptz)`;
    const baseParams = [course || null, group || null, startDate || null, endDate || null];
    const countResult = usePagination
      ? await client.query(
          `SELECT COUNT(*) AS cnt
           FROM submissions s
           JOIN users u ON u.user_id = s.user_id
           ${baseWhere}`,
          baseParams
        )
      : null;
    const total = countResult ? parseInt(countResult.rows[0].cnt, 10) : 0;

    const result = await client.query(
      `SELECT s.submission_id, COALESCE(s.course_id, u.course_id) AS course_id, s.title, s.description, s.filename, s.file_url,
              s.status, s.created_at,
              u.name AS student_name, u.email AS student_email,
              COUNT(a.assignment_id) FILTER (WHERE a.status != 'canceled') AS assigned_count,
              COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed') AS completed_count
       FROM submissions s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN assignments a ON a.submission_id = s.submission_id
       ${baseWhere}
       GROUP BY s.submission_id, COALESCE(s.course_id, u.course_id), u.name, u.email
       ORDER BY s.created_at DESC
       ${usePagination ? `LIMIT $5 OFFSET $6` : ''}`,
      usePagination ? [...baseParams, pageSize, (page - 1) * pageSize] : baseParams
    );
    const rows = result.rows;
    const totalRows = usePagination ? total : rows.length;
    return { rows, total: totalRows };
  });

  if (usePagination) {
    res.json({ submissions: rows, total });
  } else {
    res.json(rows);
  }
}

/**
 * GET /submissions/reviews/my-tasks
 * Get current user's pending review assignments.
 */
export async function getMyReviewTasks(req: AuthRequest, res: Response): Promise<void> {
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
}

/**
 * PATCH /submissions/:id
 * Student updates own submission title/description before any review exists.
 */
export async function updateSubmission(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { title, description } = req.body;

  const updated = await withDb(user_id, role, async (client) => {
    const sub = await client.query(
      `SELECT submission_id, user_id, title, description, course_id
       FROM submissions WHERE submission_id = $1`,
      [id]
    );
    if (sub.rows.length === 0) throw new AppError(404, 'Submission not found');
    if (sub.rows[0].user_id !== user_id) throw new AppError(403, 'You can only edit your own submission');

    const allowed = await canEditOrWithdraw(client, id, sub.rows[0].course_id || null);
    if (!allowed) {
      throw new AppError(400, 'Cannot edit submission after reviews are submitted');
    }

    const nextTitle = title !== undefined ? String(title).trim() : sub.rows[0].title;
    const nextDesc = description !== undefined ? String(description) : sub.rows[0].description;
    const result = await client.query(
      `UPDATE submissions
       SET title = $1, description = $2
       WHERE submission_id = $3
       RETURNING submission_id, title, description, status, created_at`,
      [nextTitle, nextDesc, id]
    );

    await audit(client, user_id, 'UPDATE', 'submission', id, {
      title_updated: title !== undefined,
      description_updated: description !== undefined,
    });
    return result.rows[0];
  });

  res.json(updated);
}

/**
 * PATCH /submissions/:id/replace-file
 * Student replaces file for own submission, honoring course policy.
 */
export async function replaceSubmissionFile(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!req.file) {
    res.status(400).json({ error: 'validation', message: 'File is required' });
    return;
  }

  const filename = req.file.filename;
  const fileUrl = `/uploads/${filename}`;

  const updated = await withDb(user_id, role, async (client) => {
    const sub = await client.query(
      `SELECT submission_id, user_id, course_id, filename
       FROM submissions WHERE submission_id = $1`,
      [id]
    );
    if (sub.rows.length === 0) throw new AppError(404, 'Submission not found');
    if (sub.rows[0].user_id !== user_id) throw new AppError(403, 'You can only edit your own submission');

    const allowed = await canEditOrWithdraw(client, id, sub.rows[0].course_id || null);
    if (!allowed) throw new AppError(400, 'Cannot replace file after reviews are submitted');

    const result = await client.query(
      `UPDATE submissions
       SET filename = $1, file_url = $2, updated_at = now()
       WHERE submission_id = $3
       RETURNING submission_id, filename, file_url, updated_at`,
      [filename, fileUrl, id]
    );

    await audit(client, user_id, 'REPLACE_FILE', 'submission', id, {
      old_filename: sub.rows[0].filename,
      new_filename: filename,
    });
    return { row: result.rows[0], oldFilename: sub.rows[0].filename };
  });

  if (updated.oldFilename && updated.oldFilename !== filename) {
    const oldPath = `${process.env.UPLOAD_DIR || './uploads'}/${updated.oldFilename}`;
    fs.unlink(oldPath, () => {});
  }

  res.json(updated.row);
}

/**
 * DELETE /submissions/:id
 * Student withdraws own submission before any review exists.
 */
export async function withdrawSubmission(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  await withDb(user_id, role, async (client) => {
    const sub = await client.query(
      `SELECT submission_id, user_id, course_id FROM submissions WHERE submission_id = $1`,
      [id]
    );
    if (sub.rows.length === 0) throw new AppError(404, 'Submission not found');
    if (sub.rows[0].user_id !== user_id) throw new AppError(403, 'You can only withdraw your own submission');

    const allowed = await canEditOrWithdraw(client, id, sub.rows[0].course_id || null);
    if (!allowed) {
      throw new AppError(400, 'Cannot withdraw submission after reviews are submitted');
    }

    await client.query(
      `UPDATE assignments
       SET status = 'canceled'
       WHERE submission_id = $1 AND status = 'pending'`,
      [id]
    );
    await client.query(`DELETE FROM submissions WHERE submission_id = $1`, [id]);

    await audit(client, user_id, 'WITHDRAW', 'submission', id, {});
  });

  scheduleMvRefresh();
  res.json({ ok: true, message: 'Submission withdrawn' });
}

/**
 * GET /submissions/my-grades
 * Student summary of file-review and released peer-review grades.
 */
export async function getMyGradesSummary(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;

  const data = await withDb(user_id, role, async (client) => {
    const fileReviewRows = await client.query(
      `SELECT
         s.submission_id,
         s.title AS submission_title,
         COALESCE(s.course_id, u.course_id) AS course_id,
         s.created_at,
         ROUND(AVG(r.score)::numeric, 2) AS avg_score,
         COUNT(r.review_id)::int AS review_count
       FROM submissions s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN reviews r ON r.submission_id = s.submission_id
       WHERE s.user_id = $1
       GROUP BY s.submission_id, s.title, COALESCE(s.course_id, u.course_id), s.created_at
       ORDER BY s.created_at DESC`,
      [user_id]
    );

    const peerReviewRows = await client.query(
      `SELECT
         prs.session_id,
         prs.title AS session_title,
         prs.course_id,
         prs.created_at,
         v.avg_technical,
         v.avg_interactions,
         v.avg_management,
         v.avg_team_chemistry,
         v.review_count
       FROM peer_review_sessions prs
       JOIN v_peer_review_averages v
         ON v.session_id = prs.session_id
       WHERE prs.scores_released = true
         AND v.reviewee_id = $1
       ORDER BY prs.created_at DESC`,
      [user_id]
    );

    return {
      file_reviews: fileReviewRows.rows,
      peer_reviews: peerReviewRows.rows,
    };
  });

  res.json(data);
}
