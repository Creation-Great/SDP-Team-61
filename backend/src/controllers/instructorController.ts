import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import type { AuthRequest } from '../types.js';
import { aggregatePeerReviewCsvFiles } from '../utils/csvPeerReview.js';
import { getUsersTableSchema } from '../utils/userSchema.js';
import { AppError } from '../utils/AppError.js';
import { scheduleMvRefresh } from '../utils/mvRefresh.js';
import { addSseClient } from '../utils/sse.js';
import { createNotification, createNotifications } from '../utils/notifications.js';

/**
 * GET /instructor/overview
 * Get aggregated overview for instructors (submissions, assignments, reviews by week).
 */
export async function getOverview(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const course = req.query.course as string | undefined;
  const group = req.query.group as string | undefined;

  const rows = await withDb(user_id, role, async (client) => {
    // Try using materialized view if available, fall back to direct query
    try {
      const r = await client.query(
        `SELECT course_id, group_id, wk, submissions, assignments, reviews_completed
         FROM mv_instructor_cohort
         WHERE ($1::text IS NULL OR course_id = $1)
           AND ($2::text IS NULL OR group_id = $2)
         ORDER BY wk DESC`,
        [course || null, group || null]
      );
      return r.rows;
    } catch {
      // MV might not exist yet, use direct query
      const r = await client.query(
        `SELECT u.course_id, u.group_id,
                date_trunc('week', COALESCE(a.created_at, s.created_at)) AS wk,
                COUNT(DISTINCT s.submission_id) AS submissions,
                COUNT(a.assignment_id) FILTER (WHERE a.status <> 'canceled') AS assignments,
                COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed') AS reviews_completed
         FROM users u
         JOIN submissions s ON s.user_id = u.user_id
         LEFT JOIN assignments a ON a.submission_id = s.submission_id
         WHERE ($1::text IS NULL OR u.course_id = $1)
           AND ($2::text IS NULL OR u.group_id = $2)
         GROUP BY u.course_id, u.group_id, wk
         ORDER BY wk DESC`,
        [course || null, group || null]
      );
      return r.rows;
    }
  });

  res.json(rows);
}

/**
 * POST /instructor/assign
 * Instructor manually assigns a reviewer to a submission.
 */
export async function assignReviewer(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { submission_id, reviewer_id } = req.body;

  const result = await withDb(user_id, role, async (client) => {

    // Try insert with ON CONFLICT
    const ins = await client.query(
      `INSERT INTO assignments (submission_id, reviewer_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT ON CONSTRAINT ux_assign_unique DO NOTHING
       RETURNING assignment_id, submission_id, reviewer_id, status, created_at`,
      [submission_id, reviewer_id]
    );

    if (ins.rowCount === 1) {
      const submissionInfo = await client.query(
        `SELECT title FROM submissions WHERE submission_id = $1`,
        [submission_id]
      );
      await audit(client, user_id, 'ASSIGN', 'assignment', ins.rows[0].assignment_id, {
        submission_id,
        reviewer_id,
        method: 'manual',
      });
      await createNotification(client, {
        userId: reviewer_id,
        type: 'review_assigned',
        title: 'New review assignment',
        body: `You have been assigned to review "${submissionInfo.rows[0]?.title || 'a submission'}".`,
        link: '/reviews',
      });
      return { code: 201, body: ins.rows[0] };
    }

    // Check if existing assignment is canceled → revive it
    const existing = await client.query(
      `SELECT assignment_id, status FROM assignments
       WHERE submission_id = $1 AND reviewer_id = $2 FOR UPDATE`,
      [submission_id, reviewer_id]
    );

    if (existing.rows.length > 0 && existing.rows[0].status === 'canceled') {
      const upd = await client.query(
        `UPDATE assignments SET status = 'pending', created_at = now()
         WHERE assignment_id = $1
         RETURNING assignment_id, submission_id, reviewer_id, status, created_at`,
        [existing.rows[0].assignment_id]
      );
      await audit(client, user_id, 'ASSIGN', 'assignment', upd.rows[0].assignment_id, {
        submission_id,
        reviewer_id,
        revived: true,
      });
      const submissionInfo = await client.query(
        `SELECT title FROM submissions WHERE submission_id = $1`,
        [submission_id]
      );
      await createNotification(client, {
        userId: reviewer_id,
        type: 'review_assigned',
        title: 'Review assignment restored',
        body: `Your review task for "${submissionInfo.rows[0]?.title || 'a submission'}" is active again.`,
        link: '/reviews',
      });
      return { code: 201, body: upd.rows[0] };
    }

    return { code: 200, body: { note: 'already_assigned', status: existing.rows[0]?.status } };
  });

  scheduleMvRefresh();

  res.status(result.code).json(result.body);
}

/**
 * POST /instructor/assign/bulk
 * Instructor bulk-assigns N reviewers for each selected submission.
 */
export async function bulkAssignReviewers(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const submissionIds: string[] = req.body.submission_ids || [];
  const reviewerCount: number = Number(req.body.reviewer_count || 1);

  const result = await withDb(user_id, role, async (client) => {
    const perSubmission: Array<{
      submission_id: string;
      assigned: number;
      requested: number;
      note?: string;
    }> = [];

    for (const submissionId of submissionIds) {
      const submissionInfo = await client.query(
        `SELECT s.submission_id, s.title, s.user_id AS author_id,
                COALESCE(s.course_id, ue.course_id, u.course_id) AS course_id,
                COALESCE(ue.group_id, u.group_id) AS group_id
         FROM submissions s
         JOIN users u ON u.user_id = s.user_id
         LEFT JOIN user_enrollments ue ON ue.user_id = u.user_id
         WHERE s.submission_id = $1
         LIMIT 1`,
        [submissionId]
      );

      if (submissionInfo.rows.length === 0) {
        perSubmission.push({ submission_id: submissionId, assigned: 0, requested: reviewerCount, note: 'submission_not_found' });
        continue;
      }

      const sub = submissionInfo.rows[0];
      const candidates = await client.query(
        `SELECT u.user_id,
                COUNT(a.assignment_id) FILTER (WHERE a.status = 'pending') AS pending_count,
                CASE WHEN COALESCE(ue.group_id, u.group_id) = $3 THEN 1 ELSE 0 END AS same_group
         FROM users u
         LEFT JOIN user_enrollments ue ON ue.user_id = u.user_id AND ue.course_id = $2
         LEFT JOIN assignments a ON a.reviewer_id = u.user_id
         WHERE u.user_id <> $1
           AND u.role = 'student'
           AND COALESCE(ue.course_id, u.course_id) IS NOT DISTINCT FROM $2
           AND NOT EXISTS (
             SELECT 1 FROM assignments x
             WHERE x.submission_id = $4 AND x.reviewer_id = u.user_id AND x.status <> 'canceled'
           )
         GROUP BY u.user_id, COALESCE(ue.group_id, u.group_id)
         ORDER BY same_group ASC, pending_count ASC
         LIMIT $5`,
        [sub.author_id, sub.course_id || null, sub.group_id || null, submissionId, reviewerCount]
      );

      let assigned = 0;
      for (const row of candidates.rows) {
        const ins = await client.query(
          `INSERT INTO assignments (submission_id, reviewer_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT ON CONSTRAINT ux_assign_unique DO NOTHING
           RETURNING assignment_id`,
          [submissionId, row.user_id]
        );
        if (ins.rowCount !== 1) continue;

        assigned += 1;
        await audit(client, user_id, 'ASSIGN', 'assignment', ins.rows[0].assignment_id, {
          submission_id: submissionId,
          reviewer_id: row.user_id,
          method: 'bulk',
        });
        await createNotification(client, {
          userId: row.user_id,
          type: 'review_assigned',
          title: 'New review assignment',
          body: `You have been assigned to review "${sub.title}".`,
          link: '/reviews',
        });
      }

      perSubmission.push({
        submission_id: submissionId,
        assigned,
        requested: reviewerCount,
        note: assigned < reviewerCount ? 'insufficient_available_reviewers' : undefined,
      });
    }

    return perSubmission;
  });

  scheduleMvRefresh();
  res.json({
    ok: true,
    summary: {
      submissions: result.length,
      assigned_total: result.reduce((sum, r) => sum + r.assigned, 0),
      requested_per_submission: reviewerCount,
    },
    results: result,
  });
}

/**
 * POST /instructor/announcements
 * Publish a system announcement to students in scope (course/group).
 */
export async function createAnnouncement(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id: instructorCourse, group_id: instructorGroup } = req.user;
  const {
    title,
    body,
    link,
    course_id: requestedCourseId,
    group_id: requestedGroupId,
  } = req.body;

  const targetCourseId = (requestedCourseId || instructorCourse || null) as string | null;
  const targetGroupId = (requestedGroupId || null) as string | null;

  const result = await withDb(user_id, role, async (client) => {
    const users = await client.query(
      `SELECT DISTINCT u.user_id
       FROM users u
       LEFT JOIN user_enrollments ue ON ue.user_id = u.user_id
       WHERE u.role = 'student'
         AND ($1::text IS NULL OR COALESCE(ue.course_id, u.course_id) = $1)
         AND ($2::text IS NULL OR COALESCE(ue.group_id, u.group_id) = $2)`,
      [targetCourseId, targetGroupId]
    );

    const recipientIds = users.rows.map((r: { user_id: string }) => r.user_id);
    if (recipientIds.length === 0) {
      return { recipients: 0 };
    }

    await createNotifications(
      client,
      recipientIds.map((id: string) => ({
        userId: id,
        type: 'system' as const,
        title: String(title).trim(),
        body: String(body).trim(),
        link: link ? String(link).trim() : undefined,
      }))
    );

    await audit(client, user_id, 'CREATE_ANNOUNCEMENT', 'notification', null, {
      recipients: recipientIds.length,
      course_id: targetCourseId,
      group_id: targetGroupId,
    });

    return { recipients: recipientIds.length };
  });

  res.status(201).json({
    ok: true,
    message: 'Announcement published',
    recipients: result.recipients,
    scope: { course_id: targetCourseId, group_id: targetGroupId },
  });
}

/**
 * POST /instructor/peer-review/aggregate
 * Upload one or more team peer-review CSV files and compute aggregated averages.
 */
export async function aggregatePeerReviewCsv(req: AuthRequest, res: Response): Promise<void> {
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (files.length === 0) {
    res.status(400).json({ error: 'validation', message: 'At least one CSV file is required' });
    return;
  }

  const result = aggregatePeerReviewCsvFiles(files);
  res.json(result);
}

/**
 * GET /instructor/checkins/current
 * Load current persisted student check-in dataset for the instructor/course/group.
 */
export async function getCurrentCheckins(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id, group_id } = req.user;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT checkin_id, file_name, headers, topics, members, weeks, updated_at
       FROM student_checkins
       WHERE instructor_id = $1
         AND course_id = $2
         AND group_id = $3`,
      [user_id, course_id || '', group_id || '']
    );
    return result.rows[0] || null;
  });

  if (!row) {
    res.status(404).json({ error: 'not_found', message: 'No saved check-ins found' });
    return;
  }

  res.json(row);
}

/**
 * POST /instructor/checkins/current
 * Persist current student check-in state (template, weeks, scores, comments).
 */
export async function saveCurrentCheckins(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id, group_id } = req.user;
  const { file_name, headers, topics, members, weeks } = req.body;

  const saved = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO student_checkins (instructor_id, course_id, group_id, file_name, headers, topics, members, weeks, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, now())
       ON CONFLICT (instructor_id, course_id, group_id)
       DO UPDATE SET
         file_name = EXCLUDED.file_name,
         headers = EXCLUDED.headers,
         topics = EXCLUDED.topics,
         members = EXCLUDED.members,
         weeks = EXCLUDED.weeks,
         updated_at = now()
       RETURNING checkin_id, updated_at`,
      [
        user_id,
        course_id || '',
        group_id || '',
        file_name || '',
        JSON.stringify(headers),
        JSON.stringify(topics),
        JSON.stringify(members),
        JSON.stringify(weeks),
      ]
    );
    return result.rows[0];
  });

  res.json({ message: 'Check-ins saved', ...saved });
}

const CHECKINS_STUDENTS_PAGE_SIZE_DEFAULT = 50;
const CHECKINS_STUDENTS_PAGE_SIZE_MAX = 200;

/**
 * GET /instructor/checkins/students
 * List students in instructor's current course/group for explicit template-row mapping.
 * Query: page, pageSize (optional). When present, response is { students, total }; otherwise array (legacy).
 */
export async function getCheckinStudents(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id, group_id } = req.user;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const rawSize = parseInt(String(req.query.pageSize || '0'), 10) || 0;
  const pageSize = rawSize <= 0 ? 0 : Math.min(CHECKINS_STUDENTS_PAGE_SIZE_MAX, Math.max(1, rawSize));
  const usePagination = pageSize > 0;

  const result = await withDb(user_id, role, async (client) => {
    const schema = await getUsersTableSchema(client);
    const displayExpr = schema.hasName
      ? 'name'
      : schema.hasNetid
        ? 'netid'
        : "'Student'";
    const emailExpr = schema.hasEmail
      ? 'email'
      : schema.hasNetid
        ? "netid || '@uconn.edu'"
        : "''";

    const hasGroup = Boolean(group_id);
    const whereFragment = hasGroup
      ? `WHERE role = 'student'
           AND (
             user_id IN (
               SELECT ue.user_id FROM user_enrollments ue
               WHERE ue.course_id = $1 AND ue.group_id = $2
             )
             OR (course_id = $1 AND group_id = $2)
           )`
      : `WHERE role = 'student'
           AND (
             user_id IN (
               SELECT ue.user_id FROM user_enrollments ue
               WHERE ue.course_id = $1
             )
             OR course_id = $1
           )`;
    const baseParams = hasGroup ? [course_id || '', group_id] : [course_id || ''];
    const orderBy = `ORDER BY ${displayExpr} ASC`;

    if (usePagination) {
      const sql = `SELECT user_id, ${displayExpr} AS display_name, ${emailExpr} AS email,
                         COUNT(*) OVER() AS _total
                   FROM users ${whereFragment} ${orderBy}
                   LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`;
      const result = await client.query(sql, [...baseParams, pageSize, (page - 1) * pageSize]);
      const rows = result.rows.map(({ _total, ...r }) => r);
      const total = result.rows[0] ? parseInt(String(result.rows[0]._total), 10) : 0;
      return { rows, total };
    }

    const sql = `SELECT user_id, ${displayExpr} AS display_name, ${emailExpr} AS email FROM users ${whereFragment} ${orderBy}`;
    const result = await client.query(sql, baseParams);
    return { rows: result.rows, total: result.rows.length };
  });

  if (usePagination) {
    res.json({ students: result.rows, total: result.total });
  } else {
    res.json(result.rows);
  }
}

/**
 * GET /instructor/unified-dashboard
 * Returns combined metrics from both review subsystems + per-student participation.
 * Query: ?course=xxx&group=yyy (optional filters)
 */
export async function getUnifiedDashboard(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const course = req.query.course as string | undefined;
  const group = req.query.group as string | undefined;

  const data = await withDb(user_id, role, async (client) => {
    const courseFilter = course || null;
    const groupFilter = group || null;

    // 1 — File review summary
    const fileSummary = await client.query(
      `SELECT
         COUNT(DISTINCT s.submission_id)                                        AS total_submissions,
         COUNT(a.assignment_id) FILTER (WHERE a.status <> 'canceled')           AS total_assigned,
         COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed')           AS total_completed
       FROM submissions s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN assignments a ON a.submission_id = s.submission_id
       WHERE ($1::text IS NULL OR COALESCE(s.course_id, u.course_id) = $1)
         AND ($2::text IS NULL OR u.group_id  = $2)`,
      [courseFilter, groupFilter]
    );

    // 2 — Peer review summary
    const peerSummary = await client.query(
      `SELECT
         COUNT(DISTINCT ps.session_id)                                    AS total_sessions,
         COUNT(DISTINCT ps.session_id) FILTER (WHERE ps.is_open = true)   AS open_sessions,
         COUNT(pr.peer_review_id) FILTER (WHERE pr.is_self = false)       AS total_reviews
       FROM peer_review_sessions ps
       LEFT JOIN peer_reviews pr ON pr.session_id = ps.session_id
       WHERE ($1::text IS NULL OR ps.course_id = $1)`,
      [courseFilter]
    );

    // 3 — Per-student participation (using the view)
    const students = await client.query(
      `SELECT user_id, name, course_id, group_id,
              file_reviews_given, file_reviews_received, avg_file_score_received,
              peer_reviews_given, peer_reviews_received, avg_peer_score_received
       FROM v_student_review_participation
       WHERE ($1::text IS NULL OR course_id = $1)
         AND ($2::text IS NULL OR group_id  = $2)
       ORDER BY name ASC`,
      [courseFilter, groupFilter]
    );

    const fRow = fileSummary.rows[0];
    const pRow = peerSummary.rows[0];

    return {
      file_reviews: {
        total_submissions: Number(fRow.total_submissions),
        total_assigned: Number(fRow.total_assigned),
        total_completed: Number(fRow.total_completed),
        completion_rate: Number(fRow.total_assigned) > 0
          ? Math.round((Number(fRow.total_completed) / Number(fRow.total_assigned)) * 100) / 100
          : 0,
      },
      peer_reviews: {
        total_sessions: Number(pRow.total_sessions),
        open_sessions: Number(pRow.open_sessions),
        total_reviews: Number(pRow.total_reviews),
      },
      student_participation: students.rows,
    };
  });

  res.json(data);
}

/**
 * GET /instructor/quality-flags
 * Detect low-quality file reviews: identical scores across a reviewer's reviews,
 * or comments shorter than 20 characters.
 * Query: ?course=xxx&group=yyy (optional filters)
 */
export async function getQualityFlags(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const course = req.query.course as string | undefined;
  const group = req.query.group as string | undefined;

  const flags = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT
         u_reviewer.name AS reviewer_name,
         u_author.name   AS author_name,
         s.title          AS submission_title,
         r.score,
         r.comments,
         r.created_at     AS review_date
       FROM reviews r
       JOIN users u_reviewer ON u_reviewer.user_id = r.reviewer_id
       JOIN submissions s ON s.submission_id = r.submission_id
       JOIN users u_author ON u_author.user_id = s.user_id
       WHERE ($1::text IS NULL OR u_reviewer.course_id = $1)
         AND ($2::text IS NULL OR u_reviewer.group_id  = $2)
       ORDER BY r.reviewer_id, r.created_at DESC`,
      [course || null, group || null]
    );

    // Group reviews by reviewer to detect identical scores
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB row shape varies
    const byReviewer = new Map<string, Array<Record<string, any>>>();
    for (const row of result.rows) {
      const key = row.reviewer_name;
      if (!byReviewer.has(key)) byReviewer.set(key, []);
      byReviewer.get(key)!.push(row);
    }

    const flagged: Array<{
      reviewer_name: string;
      author_name: string;
      submission_title: string;
      flag_reason: string;
      review_date: string;
    }> = [];

    for (const [, reviews] of byReviewer) {
      // Check if all scores are identical (only flag if >= 2 reviews)
      const scores = reviews.map((r) => Number(r.score));
      const allIdentical = scores.length >= 2 && new Set(scores).size === 1;

      for (const r of reviews) {
        const reasons: string[] = [];
        if (allIdentical) reasons.push('Identical scores across reviews');
        if ((r.comments || '').length < 20) reasons.push('Short comment');
        if (reasons.length > 0) {
          flagged.push({
            reviewer_name: r.reviewer_name,
            author_name: r.author_name,
            submission_title: r.submission_title,
            flag_reason: reasons.join(', '),
            review_date: r.review_date,
          });
        }
      }
    }

    return flagged;
  });

  res.json(flags);
}

/**
 * GET /instructor/peer-review-quality-flags
 * Detect low-quality peer reviews: identical Likert scores across all three
 * categories, or comments shorter than 20 characters.
 * Query: ?session=xxx (optional filter)
 */
export async function getPeerReviewQualityFlags(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const sessionId = req.query.session as string | undefined;

  const flags = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT
         u_reviewer.name AS reviewer_name,
         u_reviewee.name AS reviewee_name,
         ps.title         AS session_title,
         pr.technical_contributions,
         pr.team_interactions,
         pr.project_management,
         pr.individual_comments,
         pr.is_self,
         pr.updated_at
       FROM peer_reviews pr
       JOIN users u_reviewer ON u_reviewer.user_id = pr.reviewer_id
       JOIN users u_reviewee ON u_reviewee.user_id = pr.reviewee_id
       JOIN peer_review_sessions ps ON ps.session_id = pr.session_id
       WHERE pr.is_self = false
         AND ($1::text IS NULL OR pr.session_id = $1)
       ORDER BY pr.reviewer_id, pr.updated_at DESC`,
      [sessionId || null]
    );

    const flagged: Array<{
      reviewer_name: string;
      reviewee_name: string;
      session_title: string;
      flag_reason: string;
      review_date: string;
    }> = [];

    for (const row of result.rows) {
      const reasons: string[] = [];

      // Identical Likert scores across all three categories
      const scores = [
        Number(row.technical_contributions),
        Number(row.team_interactions),
        Number(row.project_management),
      ];
      if (new Set(scores).size === 1) {
        reasons.push('Identical scores across categories');
      }

      // Short comment
      if ((row.individual_comments || '').length < 20) {
        reasons.push('Short comment');
      }

      if (reasons.length > 0) {
        flagged.push({
          reviewer_name: row.reviewer_name,
          reviewee_name: row.reviewee_name,
          session_title: row.session_title,
          flag_reason: reasons.join(', '),
          review_date: row.updated_at,
        });
      }
    }

    return flagged;
  });

  res.json(flags);
}

/**
 * GET /instructor/export-csv
 * Export file review analytics as a downloadable CSV.
 * Query: ?course=xxx&group=yyy (optional filters)
 */
export async function exportFileReviewCsv(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const course = req.query.course as string | undefined;
  const group = req.query.group as string | undefined;
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;
  const anonymized = String(req.query.anonymized || '').toLowerCase() === 'true';

  const data = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT
         u.name                AS student_name,
         COALESCE(s.course_id, u.course_id) AS course_id,
         u.group_id,
         s.title               AS submission_title,
         s.status              AS submission_status,
         s.created_at          AS submission_date,
         COUNT(a.assignment_id) FILTER (WHERE a.status <> 'canceled')  AS assigned_count,
         COUNT(a.assignment_id) FILTER (WHERE a.status = 'completed')  AS completed_count,
         ROUND(AVG(r.score)::numeric, 2) AS avg_score
       FROM submissions s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN assignments a ON a.submission_id = s.submission_id
       LEFT JOIN reviews r ON r.submission_id = s.submission_id
       WHERE ($1::text IS NULL OR COALESCE(s.course_id, u.course_id) = $1)
         AND ($2::text IS NULL OR u.group_id  = $2)
         AND ($3::timestamptz IS NULL OR s.created_at >= $3::timestamptz)
         AND ($4::timestamptz IS NULL OR s.created_at <= $4::timestamptz)
       GROUP BY s.submission_id, u.name, COALESCE(s.course_id, u.course_id), u.group_id, s.title, s.status, s.created_at
       ORDER BY u.name, s.created_at DESC`,
      [course || null, group || null, startDate || null, endDate || null]
    );
    return result.rows;
  });

  // Build CSV
  const escape = (val: string) => {
    if (val && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val || '';
  };

  const header = 'Student,Course,Group,Submission,Status,Date,Assigned,Completed,Avg Score';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB row shape for CSV export
  const rows = data.map((r: Record<string, any>) =>
    [
      escape(anonymized ? '' : (r.student_name || '')),
      escape(r.course_id || ''),
      escape(anonymized ? '' : (r.group_id || '')),
      escape(r.submission_title || ''),
      escape(r.submission_status || ''),
      r.submission_date ? new Date(r.submission_date).toISOString().slice(0, 10) : '',
      r.assigned_count ?? '0',
      r.completed_count ?? '0',
      r.avg_score ?? '',
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=file-review-analytics.csv');
  res.send(csv);
}

/**
 * GET /instructor/events
 * SSE stream for real-time dashboard events (submissions, reviews, peer reviews).
 * The instructor subscribes once; the channel is scoped to their course.
 * Since EventSource cannot set headers, pass JWT via ?token= query param.
 */
export async function streamEvents(req: AuthRequest, res: Response): Promise<void> {
  const channel = req.user.course_id
    ? `course:${req.user.course_id}`
    : `instructor:${req.user.user_id}`;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Register client
  addSseClient(channel, res);

  // Heartbeat every 30 s as a named event so the client can detect silence and reconnect
  const heartbeat = setInterval(() => {
    try {
      res.write('event: heartbeat\ndata: {}\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
}

/**
 * GET /instructor/submission-policy?course_id=...
 * Get submission edit/withdraw policy for a course.
 */
export async function getSubmissionPolicy(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id } = req.user;
  const targetCourse = (req.query.course_id as string | undefined) || course_id || null;
  if (!targetCourse) throw new AppError(400, 'course_id is required');

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT course_id, allow_edit_withdraw_after_reviews, updated_at
       FROM submission_policies
       WHERE course_id = $1
       LIMIT 1`,
      [targetCourse]
    );
    return result.rows[0] || {
      course_id: targetCourse,
      allow_edit_withdraw_after_reviews: false,
      updated_at: null,
    };
  });
  res.json(row);
}

/**
 * PUT /instructor/submission-policy
 * Upsert submission edit/withdraw policy for a course.
 */
export async function upsertSubmissionPolicy(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { course_id, allow_edit_withdraw_after_reviews } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO submission_policies (course_id, allow_edit_withdraw_after_reviews, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (course_id)
       DO UPDATE SET
         allow_edit_withdraw_after_reviews = EXCLUDED.allow_edit_withdraw_after_reviews,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING course_id, allow_edit_withdraw_after_reviews, updated_at`,
      [course_id, allow_edit_withdraw_after_reviews, user_id]
    );
    await audit(client, user_id, 'UPSERT_SUBMISSION_POLICY', 'submission_policy', null, {
      course_id,
      allow_edit_withdraw_after_reviews,
    });
    return result.rows[0];
  });
  res.json(row);
}
