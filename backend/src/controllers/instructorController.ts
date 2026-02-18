import { Response } from 'express';
import { withDb } from '../db.js';
import type { AuthRequest } from '../types.js';
import { aggregatePeerReviewCsvFiles } from '../utils/csvPeerReview.js';
import { getUsersTableSchema } from '../utils/userSchema.js';

async function ensureStudentCheckinsTable(client: any): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS student_checkins (
      checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      instructor_id UUID NOT NULL REFERENCES users(user_id),
      course_id TEXT NOT NULL DEFAULT '',
      group_id TEXT NOT NULL DEFAULT '',
      file_name TEXT,
      headers JSONB NOT NULL DEFAULT '[]'::jsonb,
      topics JSONB NOT NULL DEFAULT '[]'::jsonb,
      members JSONB NOT NULL DEFAULT '[]'::jsonb,
      weeks JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (instructor_id, course_id, group_id)
    );
  `);
}

/**
 * GET /instructor/overview
 * Get aggregated overview for instructors (submissions, assignments, reviews by week).
 */
export async function getOverview(req: AuthRequest, res: Response): Promise<void> {
  try {
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
  } catch (err) {
    console.error('Error fetching overview:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch overview' });
  }
}

/**
 * POST /instructor/assign
 * Instructor manually assigns a reviewer to a submission.
 */
export async function assignReviewer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { submission_id, reviewer_id } = req.body;

    if (!submission_id || !reviewer_id) {
      res.status(400).json({ error: 'validation', message: 'submission_id and reviewer_id are required' });
      return;
    }

    const result = await withDb(user_id, role, async (client) => {
      const { audit: doAudit } = await import('../utils/audit.js');

      // Try insert with ON CONFLICT
      const ins = await client.query(
        `INSERT INTO assignments (submission_id, reviewer_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT ON CONSTRAINT ux_assign_unique DO NOTHING
         RETURNING assignment_id, submission_id, reviewer_id, status, created_at`,
        [submission_id, reviewer_id]
      );

      if (ins.rowCount === 1) {
        await doAudit(client, user_id, 'ASSIGN', 'assignment', ins.rows[0].assignment_id, {
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
        await doAudit(client, user_id, 'ASSIGN', 'assignment', upd.rows[0].assignment_id, {
          submission_id,
          reviewer_id,
          revived: true,
        });
        return { code: 201, body: upd.rows[0] };
      }

      return { code: 200, body: { note: 'already_assigned', status: existing.rows[0]?.status } };
    });

    res.status(result.code).json(result.body);
  } catch (err) {
    console.error('Error assigning reviewer:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to assign reviewer' });
  }
}

/**
 * POST /instructor/peer-review/aggregate
 * Upload one or more team peer-review CSV files and compute aggregated averages.
 */
export async function aggregatePeerReviewCsv(req: AuthRequest, res: Response): Promise<void> {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'validation', message: 'At least one CSV file is required' });
      return;
    }

    const result = aggregatePeerReviewCsvFiles(files);
    res.json(result);
  } catch (err) {
    console.error('Error aggregating peer review CSV files:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to aggregate peer review data' });
  }
}

/**
 * GET /instructor/checkins/current
 * Load current persisted student check-in dataset for the instructor/course/group.
 */
export async function getCurrentCheckins(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role, course_id, group_id } = req.user;

    const row = await withDb(user_id, role, async (client) => {
      await ensureStudentCheckinsTable(client);
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
  } catch (err) {
    console.error('Error loading current check-ins:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to load saved check-ins' });
  }
}

/**
 * POST /instructor/checkins/current
 * Persist current student check-in state (template, weeks, scores, comments).
 */
export async function saveCurrentCheckins(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role, course_id, group_id } = req.user;
    const { file_name, headers, topics, members, weeks } = req.body || {};

    if (!Array.isArray(headers) || !Array.isArray(topics) || !Array.isArray(members) || !Array.isArray(weeks)) {
      res.status(400).json({ error: 'validation', message: 'headers, topics, members, and weeks arrays are required' });
      return;
    }

    const saved = await withDb(user_id, role, async (client) => {
      await ensureStudentCheckinsTable(client);
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
  } catch (err) {
    console.error('Error saving check-ins:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to save check-ins' });
  }
}

/**
 * GET /instructor/checkins/students
 * List students in instructor's current course/group for explicit template-row mapping.
 */
export async function getCheckinStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
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

      const result = await client.query(
        `SELECT user_id, ${displayExpr} AS display_name, ${emailExpr} AS email
         FROM users
         WHERE role = 'student'
           AND course_id = $1
           AND group_id = $2
         ORDER BY ${displayExpr} ASC`,
        [course_id || '', group_id || '']
      );
      return result.rows;
    });

    res.json(students);
  } catch (err) {
    console.error('Error loading check-in students:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to load students for mapping' });
  }
}
