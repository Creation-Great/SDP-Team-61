import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import type { AuthRequest } from '../types.js';
import { aggregatePeerReviewCsvFiles } from '../utils/csvPeerReview.js';
import { getUsersTableSchema } from '../utils/userSchema.js';
import { AppError } from '../utils/AppError.js';
import { scheduleMvRefresh } from '../utils/mvRefresh.js';
import { addSseClient } from '../utils/sse.js';

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
      await audit(client, user_id, 'ASSIGN', 'assignment', ins.rows[0].assignment_id, {
        submission_id,
        reviewer_id,
        method: 'manual',
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
      return { code: 201, body: upd.rows[0] };
    }

    return { code: 200, body: { note: 'already_assigned', status: existing.rows[0]?.status } };
  });

  scheduleMvRefresh();

  res.status(result.code).json(result.body);
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

/**
 * GET /instructor/checkins/students
 * List students in instructor's current course/group for explicit template-row mapping.
 */
export async function getCheckinStudents(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id, group_id } = req.user;

  const students = await withDb(user_id, role, async (client) => {
    const schema = await getUsersTableSchema(client as any);
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

    // When group_id is absent, return all students in the course (instructor supervises whole course)
    const hasGroup = Boolean(group_id);
    const sql = hasGroup
      ? `SELECT user_id, ${displayExpr} AS display_name, ${emailExpr} AS email
         FROM users
         WHERE role = 'student'
           AND (
             user_id IN (
               SELECT ue.user_id FROM user_enrollments ue
               WHERE ue.course_id = $1 AND ue.group_id = $2
             )
             OR (course_id = $1 AND group_id = $2)
           )
         ORDER BY ${displayExpr} ASC`
      : `SELECT user_id, ${displayExpr} AS display_name, ${emailExpr} AS email
         FROM users
         WHERE role = 'student'
           AND (
             user_id IN (
               SELECT ue.user_id FROM user_enrollments ue
               WHERE ue.course_id = $1
             )
             OR course_id = $1
           )
         ORDER BY ${displayExpr} ASC`;
    const params = hasGroup ? [course_id || '', group_id] : [course_id || ''];
    const result = await client.query(sql, params);
    return result.rows;
  });

  res.json(students);
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
       WHERE ($1::text IS NULL OR u.course_id = $1)
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
    const byReviewer = new Map<string, any[]>();
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
      const scores = reviews.map((r: any) => Number(r.score));
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

  const data = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT
         u.name                AS student_name,
         u.course_id,
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
       WHERE ($1::text IS NULL OR u.course_id = $1)
         AND ($2::text IS NULL OR u.group_id  = $2)
       GROUP BY s.submission_id, u.name, u.course_id, u.group_id, s.title, s.status, s.created_at
       ORDER BY u.name, s.created_at DESC`,
      [course || null, group || null]
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
  const rows = data.map((r: any) =>
    [
      escape(r.student_name || ''),
      escape(r.course_id || ''),
      escape(r.group_id || ''),
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

  // Heartbeat every 30 s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
}
