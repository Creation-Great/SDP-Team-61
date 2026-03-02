import { Response } from 'express';
import { withDbNoRLS } from '../db.js';
import { addSseClient, emitSseEvent } from '../utils/sse.js';
import type { AuthRequest } from '../types.js';

/**
 * Compute closes_at as 7 days from now at 23:59 ET (04:59 UTC next day).
 */
function computeClosesAt(customClosesAt?: string): Date {
  if (customClosesAt) {
    const d = new Date(customClosesAt);
    if (!isNaN(d.getTime())) return d;
  }
  const now = new Date();
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 7);
  d.setUTCHours(4, 59, 0, 0); // 04:59 UTC = 23:59 ET (UTC-5)
  return d;
}

/**
 * Snapshot students from the latest per-team definition into week_students for a given set of teams.
 * Returns an array of { id, team_key, user_id } for use in assignment generation.
 */
async function snapshotStudentsForTeams(
  client: any,
  courseId: string,
  weekId: string,
  teamKeys: string[]
): Promise<{ id: string; team_key: string; user_id: string | null }[]> {
  const weekStudentIds: { id: string; team_key: string; user_id: string | null }[] = [];

  for (const teamKey of teamKeys) {
    // Get the latest definition containing this team_key
    const latestDefResult = await client.query(
      `SELECT DISTINCT ON (ds.team_key)
              ds.team_key,
              cd.definition_id
       FROM definition_students ds
       JOIN course_definitions cd ON cd.definition_id = ds.definition_id
       WHERE cd.course_id = $1 AND ds.team_key = $2
       ORDER BY ds.team_key, cd.uploaded_at DESC`,
      [courseId, teamKey]
    );

    if (latestDefResult.rows.length === 0) continue;
    const { definition_id } = latestDefResult.rows[0];

    // Get students for this team from that definition
    const studentsResult = await client.query(
      `SELECT full_name, netid_guess FROM definition_students
       WHERE definition_id = $1 AND team_key = $2`,
      [definition_id, teamKey]
    );

    for (const s of studentsResult.rows) {
      const memberResult = await client.query(
        `SELECT user_id FROM course_members WHERE course_id = $1 AND netid_guess = $2 LIMIT 1`,
        [courseId, s.netid_guess]
      );
      const userId = memberResult.rows[0]?.user_id || null;

      const wsResult = await client.query(
        `INSERT INTO week_students (week_id, team_key, full_name, netid_guess, user_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [weekId, teamKey, s.full_name, s.netid_guess, userId]
      );

      if (wsResult.rows.length > 0) {
        weekStudentIds.push({ id: wsResult.rows[0].id, team_key: teamKey, user_id: userId });
      }
    }
  }

  return weekStudentIds;
}

/**
 * Snapshot categories from the most recent definition in this course into week_categories.
 */
async function snapshotCategories(
  client: any,
  courseId: string,
  weekId: string
): Promise<void> {
  const latestDefResult = await client.query(
    `SELECT definition_id FROM course_definitions WHERE course_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
    [courseId]
  );
  if (latestDefResult.rows.length === 0) return;
  const definition_id = latestDefResult.rows[0].definition_id;

  await client.query(
    `INSERT INTO week_categories (week_id, label, sort_order)
     SELECT $1, label, sort_order FROM definition_categories WHERE definition_id = $2`,
    [weekId, definition_id]
  );
}

/**
 * Generate within-team review assignments for the given week_students.
 */
async function generateAssignments(
  client: any,
  weekId: string,
  weekStudentIds: { id: string; team_key: string; user_id: string | null }[]
): Promise<number> {
  const teamGroups = new Map<string, { id: string; user_id: string | null }[]>();
  for (const ws of weekStudentIds) {
    if (!teamGroups.has(ws.team_key)) teamGroups.set(ws.team_key, []);
    teamGroups.get(ws.team_key)!.push({ id: ws.id, user_id: ws.user_id });
  }

  let assignmentsCreated = 0;
  for (const members of teamGroups.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = 0; j < members.length; j++) {
        if (i === j) continue;
        const reviewer = members[i];
        const reviewee = members[j];
        if (!reviewer.user_id) continue;

        await client.query(
          `INSERT INTO review_assignments (week_id, reviewer_user_id, reviewee_week_student_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (week_id, reviewer_user_id, reviewee_week_student_id) DO NOTHING`,
          [weekId, reviewer.user_id, reviewee.id]
        );
        assignmentsCreated++;
      }
    }
  }

  return assignmentsCreated;
}

/**
 * POST /courses/:courseId/weeks
 * Create a new week for the course. Instructor only.
 *
 * Body:
 * {
 *   scopeType: 'ALL' | 'TEAM',
 *   teamKeys?: string[],       // required if scopeType === 'TEAM'
 *   existingWeekId?: string,   // if provided, add teamKeys to this week instead of creating new
 *   closesAt?: string          // ISO string; default = 7 days from now at 11:59 PM ET
 * }
 */
export async function createWeek(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Instructors only' });
      return;
    }

    const courseId = String(req.params.courseId);
    const { scopeType = 'ALL', teamKeys, existingWeekId: existingWeekIdRaw, closesAt: customClosesAt } = req.body;
    const existingWeekId: string | undefined = typeof existingWeekIdRaw === 'string' ? existingWeekIdRaw : undefined;

    if (!['ALL', 'TEAM'].includes(scopeType)) {
      res.status(400).json({ error: 'validation', message: 'scopeType must be ALL or TEAM' });
      return;
    }
    if (scopeType === 'TEAM' && (!teamKeys || !Array.isArray(teamKeys) || teamKeys.length === 0)) {
      res.status(400).json({ error: 'validation', message: 'teamKeys array required for TEAM scope' });
      return;
    }

    const result = await withDbNoRLS(async (client) => {
      // 1. Verify instructor owns course
      const courseCheck = await client.query(
        `SELECT course_id FROM courses WHERE course_id = $1 AND instructor_user_id = $2`,
        [courseId, req.user.user_id]
      );
      if (courseCheck.rows.length === 0 && req.user.role !== 'admin') {
        throw { status: 403, message: 'Not your course' };
      }

      // 2. Verify at least one definition exists
      const defResult = await client.query(
        `SELECT definition_id FROM course_definitions WHERE course_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
        [courseId]
      );
      if (defResult.rows.length === 0) {
        throw { status: 400, message: 'Upload a course definition CSV first' };
      }
      const latestDefinitionId = defResult.rows[0].definition_id;

      // ──────────────────────────────────────────────────
      // Case A: Add to existing open week
      // ──────────────────────────────────────────────────
      if (existingWeekId) {
        if (scopeType !== 'TEAM') {
          throw { status: 400, message: 'existingWeekId can only be used with scopeType TEAM' };
        }

        // Verify week exists, belongs to this course, and is still open
        const existingWeekResult = await client.query(
          `SELECT week_id, week_number, opens_at, closes_at, scope_type,
                  (closes_at > now()) AS is_open
           FROM weeks WHERE week_id = $1 AND course_id = $2`,
          [existingWeekId, courseId]
        );
        if (existingWeekResult.rows.length === 0) {
          throw { status: 404, message: 'Week not found' };
        }
        const existingWeek = existingWeekResult.rows[0];
        if (!existingWeek.is_open) {
          throw { status: 400, message: 'Cannot add teams to a closed week' };
        }

        // Add each teamKey not already in week_teams
        let newStudentIds: { id: string; team_key: string; user_id: string | null }[] = [];
        for (const tk of teamKeys as string[]) {
          // Check if already in this week
          const existingTeamResult = await client.query(
            `SELECT week_team_id FROM week_teams WHERE week_id = $1 AND team_key = $2`,
            [existingWeekId, tk]
          );
          if (existingTeamResult.rows.length > 0) continue; // already added

          // Add to week_teams
          await client.query(
            `INSERT INTO week_teams (week_id, team_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [existingWeekId, tk]
          );

          // Snapshot students for this team into week_students
          const snapshotted = await snapshotStudentsForTeams(client, courseId, existingWeekId as string, [tk]);
          newStudentIds = newStudentIds.concat(snapshotted);
        }

        // Generate assignments for newly added students
        await generateAssignments(client, existingWeekId, newStudentIds);

        // Return the updated week with team_keys
        const updatedWeekResult = await client.query(
          `SELECT w.week_id, w.course_id, w.week_number, w.opens_at, w.closes_at,
                  w.scope_type, (w.closes_at > now()) AS is_open,
                  COALESCE(
                    (SELECT array_agg(wt.team_key ORDER BY wt.team_key)
                     FROM week_teams wt WHERE wt.week_id = w.week_id),
                    ARRAY[]::text[]
                  ) AS team_keys
           FROM weeks w WHERE w.week_id = $1`,
          [existingWeekId]
        );
        return updatedWeekResult.rows[0];
      }

      // ──────────────────────────────────────────────────
      // Case B: Create a new week
      // ──────────────────────────────────────────────────

      // Compute next week_number
      const weekNumResult = await client.query(
        `SELECT COALESCE(MAX(week_number), 0) + 1 AS next_num FROM weeks WHERE course_id = $1`,
        [courseId]
      );
      const weekNumber = weekNumResult.rows[0].next_num;

      // Compute opens_at / closes_at
      const opensAt = new Date();
      const closesAt = computeClosesAt(customClosesAt);

      // Insert week (scope_team_key kept for backward compat but unused for multi-team)
      const weekResult = await client.query(
        `INSERT INTO weeks (course_id, week_number, opens_at, closes_at, scope_type, scope_team_key, definition_id_at_creation)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING week_id, week_number, opens_at, closes_at, scope_type`,
        [courseId, weekNumber, opensAt, closesAt, scopeType,
         (scopeType === 'TEAM' && teamKeys?.length === 1) ? teamKeys[0] : null,
         latestDefinitionId]
      );
      const week: { week_id: string; week_number: number; opens_at: Date; closes_at: Date; scope_type: string } = weekResult.rows[0];

      // If TEAM scope, insert into week_teams junction
      let teamsToSnapshot: string[];
      if (scopeType === 'TEAM') {
        for (const tk of teamKeys as string[]) {
          await client.query(
            `INSERT INTO week_teams (week_id, team_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [week.week_id, tk]
          );
        }
        teamsToSnapshot = teamKeys as string[];
      } else {
        // ALL scope: get all distinct team_keys in this course
        const allTeamsResult = await client.query(
          `SELECT DISTINCT ds.team_key
           FROM definition_students ds
           JOIN course_definitions cd ON cd.definition_id = ds.definition_id
           WHERE cd.course_id = $1`,
          [courseId]
        );
        teamsToSnapshot = allTeamsResult.rows.map((r: any) => r.team_key);
      }

      // Snapshot students and categories
      const weekStudentIds = await snapshotStudentsForTeams(client, courseId, week.week_id, teamsToSnapshot);
      await snapshotCategories(client, courseId, week.week_id);

      // Generate assignments
      const assignmentsCreated = await generateAssignments(client, week.week_id, weekStudentIds);

      // Get team_keys for response
      const teamKeysResult = await client.query(
        `SELECT array_agg(team_key ORDER BY team_key) AS team_keys FROM week_teams WHERE week_id = $1`,
        [week.week_id]
      );
      const returnedTeamKeys = teamKeysResult.rows[0]?.team_keys || [];

      return {
        ...week,
        is_open: true,
        team_keys: returnedTeamKeys,
        assignments_created: assignmentsCreated,
      };
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('createWeek error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create week' });
  }
}

/**
 * GET /courses/:courseId/weeks
 * List weeks for a course with their team_keys.
 */
export async function listWeeks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { courseId } = req.params;

    const weeks = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT w.week_id, w.course_id, w.week_number, w.opens_at, w.closes_at,
                w.scope_type, w.scope_team_key,
                (w.closes_at > now()) AS is_open,
                COALESCE(
                  (SELECT array_agg(wt.team_key ORDER BY wt.team_key)
                   FROM week_teams wt WHERE wt.week_id = w.week_id),
                  ARRAY[]::text[]
                ) AS team_keys
         FROM weeks w WHERE w.course_id = $1 ORDER BY w.week_number DESC`,
        [courseId]
      );
      return r.rows;
    });

    res.json(weeks);
  } catch (err) {
    console.error('listWeeks error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list weeks' });
  }
}

/**
 * GET /courses/:courseId/weeks/:weekId/status
 * Get completion status per student. Instructor only.
 */
export async function getWeekStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Instructors only' });
      return;
    }

    const { weekId } = req.params;

    const rows = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT
           ws.id,
           ws.full_name,
           ws.team_key,
           ws.netid_guess,
           COUNT(ra.assignment_id) FILTER (WHERE ra.status != 'CANCELLED') AS total_assignments,
           COUNT(ra.assignment_id) FILTER (WHERE ra.status = 'SUBMITTED') AS submitted_assignments
         FROM week_students ws
         LEFT JOIN review_assignments ra ON ra.reviewer_user_id = ws.user_id AND ra.week_id = ws.week_id
         WHERE ws.week_id = $1
         GROUP BY ws.id, ws.full_name, ws.team_key, ws.netid_guess
         ORDER BY ws.team_key, ws.full_name`,
        [weekId]
      );
      return r.rows;
    });

    res.json(rows);
  } catch (err) {
    console.error('getWeekStatus error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get week status' });
  }
}

/**
 * GET /courses/:courseId/weeks/:weekId/analytics
 * Get student and team analytics. Instructor only.
 */
export async function getWeekAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Instructors only' });
      return;
    }

    const { weekId } = req.params;

    const [students, teams] = await withDbNoRLS(async (client) => {
      const studentsResult = await client.query(
        `SELECT wsa.id, wsa.reviewee_week_student_id, ws.full_name, ws.team_key,
                wsa.avg_overall, wsa.per_category_json, wsa.n_reviews
         FROM week_student_aggregates wsa
         JOIN week_students ws ON ws.id = wsa.reviewee_week_student_id
         WHERE wsa.week_id = $1
         ORDER BY ws.team_key, ws.full_name`,
        [weekId]
      );

      const teamsResult = await client.query(
        `SELECT team_key, avg_overall, per_category_json, n_reviews
         FROM week_team_aggregates WHERE week_id = $1
         ORDER BY team_key`,
        [weekId]
      );

      return [studentsResult.rows, teamsResult.rows];
    });

    res.json({ students, teams });
  } catch (err) {
    console.error('getWeekAnalytics error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get analytics' });
  }
}

/**
 * GET /courses/:courseId/weeks/:weekId
 * Get a single week's details with team_keys.
 */
export async function getWeek(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { weekId, courseId } = req.params;

    const week = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT w.week_id, w.course_id, w.week_number, w.opens_at, w.closes_at,
                w.scope_type, w.scope_team_key, (w.closes_at > now()) AS is_open,
                COALESCE(
                  (SELECT array_agg(wt.team_key ORDER BY wt.team_key)
                   FROM week_teams wt WHERE wt.week_id = w.week_id),
                  ARRAY[]::text[]
                ) AS team_keys
         FROM weeks w WHERE w.week_id = $1 AND w.course_id = $2`,
        [weekId, courseId]
      );
      return r.rows[0] || null;
    });

    if (!week) {
      res.status(404).json({ error: 'not_found', message: 'Week not found' });
      return;
    }
    res.json(week);
  } catch (err) {
    console.error('getWeek error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get week' });
  }
}

/**
 * GET /courses/:courseId/weeks/:weekId/events
 * SSE stream for live events. Instructor only.
 * Pass JWT as ?token= query param since EventSource can't set headers.
 */
export async function streamWeekEvents(req: AuthRequest, res: Response): Promise<void> {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden', message: 'Instructors only' });
    return;
  }

  const weekId = String(req.params.weekId);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Register this client
  addSseClient(weekId, res);

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
}
