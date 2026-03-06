import { Response } from 'express';
import { withDb, withDbNoRLS } from '../db.js';
import { parseCsv } from '../utils/csvParser.js';
import type { AuthRequest } from '../types.js';

/**
 * POST /courses
 * Create a new course. Instructor only.
 */
export async function createCourse(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Instructors only' });
      return;
    }

    const { name, term } = req.body;
    if (!name) {
      res.status(400).json({ error: 'validation', message: 'Course name is required' });
      return;
    }

    const course = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `INSERT INTO courses (instructor_user_id, name, term)
         VALUES ($1, $2, $3)
         RETURNING course_id, name, term, created_at`,
        [req.user.user_id, name, term || null]
      );
      return r.rows[0];
    });

    res.status(201).json(course);
  } catch (err) {
    console.error('createCourse error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create course' });
  }
}

/**
 * GET /courses
 * List courses for the current user.
 * Instructors see their own courses; students see enrolled courses.
 */
export async function listCourses(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;

    const courses = await withDbNoRLS(async (client) => {
      if (role === 'instructor' || role === 'admin') {
        const r = await client.query(
          `SELECT c.course_id, c.name, c.term, c.created_at,
                  (SELECT count(*) FROM course_members cm WHERE cm.course_id = c.course_id) AS student_count,
                  (SELECT count(*) FROM weeks w WHERE w.course_id = c.course_id AND w.closes_at > now()) AS active_week_count,
                  -- total_students: all week_students rows in closed weeks for this course.
                  -- Unlinked students (user_id IS NULL) count as not completed.
                  (SELECT count(*) FROM week_students ws
                     JOIN weeks w ON w.week_id = ws.week_id
                     WHERE w.course_id = c.course_id AND w.closes_at <= now()) AS total_students_in_closed_weeks,
                  -- completed_students: linked students who submitted all their non-cancelled assignments
                  -- in closed weeks. Unlinked students are never counted as complete.
                  (SELECT count(*) FROM week_students ws
                     JOIN weeks w ON w.week_id = ws.week_id
                     WHERE w.course_id = c.course_id
                       AND w.closes_at <= now()
                       AND ws.user_id IS NOT NULL
                       AND (
                         SELECT count(*) FROM review_assignments ra
                         WHERE ra.week_id = ws.week_id
                           AND ra.reviewer_user_id = ws.user_id
                           AND ra.status != 'CANCELLED'
                       ) > 0
                       AND (
                         SELECT count(*) FROM review_assignments ra
                         WHERE ra.week_id = ws.week_id
                           AND ra.reviewer_user_id = ws.user_id
                           AND ra.status = 'SUBMITTED'
                       ) = (
                         SELECT count(*) FROM review_assignments ra
                         WHERE ra.week_id = ws.week_id
                           AND ra.reviewer_user_id = ws.user_id
                           AND ra.status != 'CANCELLED'
                       )
                  ) AS completed_students_in_closed_weeks,
                  -- Keep raw assignment counts for the "Reviews Submitted" status snapshot
                  (SELECT count(*) FROM review_assignments ra
                     JOIN weeks w ON w.week_id = ra.week_id
                     WHERE w.course_id = c.course_id AND ra.status != 'CANCELLED') AS total_assignments,
                  (SELECT count(*) FROM review_assignments ra
                     JOIN weeks w ON w.week_id = ra.week_id
                     WHERE w.course_id = c.course_id AND ra.status = 'SUBMITTED') AS submitted_assignments
           FROM courses c
           WHERE c.instructor_user_id = $1
           ORDER BY c.created_at DESC`,
          [user_id]
        );
        return r.rows;
      } else {
        const r = await client.query(
          `SELECT c.course_id, c.name, c.term, c.created_at
           FROM courses c
           JOIN course_members cm ON cm.course_id = c.course_id
           WHERE cm.user_id = $1
           ORDER BY c.created_at DESC`,
          [user_id]
        );
        return r.rows;
      }
    });

    res.json(courses);
  } catch (err) {
    console.error('listCourses error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list courses' });
  }
}

/**
 * GET /courses/:courseId
 * Get a specific course with latest definition preview and weeks.
 */
export async function getCourseById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { courseId } = req.params;
    const { user_id, role } = req.user;

    const result = await withDbNoRLS(async (client) => {
      // Verify access
      if (role === 'instructor' || role === 'admin') {
        const r = await client.query(
          `SELECT course_id, name, term, created_at, instructor_user_id FROM courses WHERE course_id = $1`,
          [courseId]
        );
        if (r.rows.length === 0) return null;
        if (r.rows[0].instructor_user_id !== user_id && role !== 'admin') return null;
        return r.rows[0];
      } else {
        const r = await client.query(
          `SELECT c.course_id, c.name, c.term, c.created_at
           FROM courses c
           JOIN course_members cm ON cm.course_id = c.course_id
           WHERE c.course_id = $1 AND cm.user_id = $2`,
          [courseId, user_id]
        );
        return r.rows[0] || null;
      }
    });

    if (!result) {
      res.status(404).json({ error: 'not_found', message: 'Course not found' });
      return;
    }

    // Get latest definition
    const defResult = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT definition_id, uploaded_at FROM course_definitions WHERE course_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
        [courseId]
      );
      return r.rows[0] || null;
    });

    // Get weeks with team_keys from week_teams junction
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

    res.json({ ...result, latest_definition: defResult, weeks });
  } catch (err) {
    console.error('getCourseById error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch course' });
  }
}

/**
 * POST /courses/:courseId/definition/upload
 * Upload and parse a course definition CSV.
 * Field name: "file" (single file).
 *
 * Per-team upload logic:
 * - Each upload creates a new course_definitions record
 * - Only teams present in the uploaded CSV are updated
 * - Other teams remain using their previous definition
 * - Active open weeks that include these teams get propagated:
 *   new students get assignments, removed students get CANCELLED assignments
 */
export async function uploadDefinition(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Instructors only' });
      return;
    }

    const { courseId } = req.params;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      res.status(400).json({ error: 'validation', message: 'CSV file is required (field name: file)' });
      return;
    }

    // Verify instructor owns this course
    const courseCheck = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT course_id FROM courses WHERE course_id = $1 AND instructor_user_id = $2`,
        [courseId, req.user.user_id]
      );
      return r.rows[0] || null;
    });

    if (!courseCheck && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Not your course' });
      return;
    }

    // Parse CSV
    let parsed;
    try {
      parsed = parseCsv(file.buffer);
    } catch (parseErr: any) {
      res.status(400).json({ error: 'validation', message: parseErr.message });
      return;
    }

    // Insert into DB in one transaction
    const definition = await withDbNoRLS(async (client) => {
      // Insert course_definition record
      const defResult = await client.query(
        `INSERT INTO course_definitions (course_id, uploaded_by) VALUES ($1, $2) RETURNING definition_id, uploaded_at`,
        [courseId, req.user.user_id]
      );
      const definition_id = defResult.rows[0].definition_id;
      const uploaded_at = defResult.rows[0].uploaded_at;

      // Insert definition_students and definition_categories for each team in this upload
      for (const team of parsed.teams) {
        for (const student of team.students) {
          await client.query(
            `INSERT INTO definition_students (definition_id, team_key, full_name, first_name, last_name, netid_guess)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [definition_id, student.team_key, student.full_name, student.first_name, student.last_name, student.netid_guess]
          );
        }
      }

      // Insert definition_categories (global to this definition upload)
      for (let i = 0; i < parsed.categories.length; i++) {
        await client.query(
          `INSERT INTO definition_categories (definition_id, label, sort_order) VALUES ($1, $2, $3)`,
          [definition_id, parsed.categories[i], i]
        );
      }

      // Propagate to active open weeks for each team in this upload
      const uploadedTeamKeys = parsed.teams.map(t => t.key);

      for (const team of parsed.teams) {
        const teamKey = team.key;
        const newStudents = team.students; // array of ParsedStudent

        // Find open weeks that include this team:
        // scope_type='ALL' OR this team_key is in week_teams
        const openWeeksResult = await client.query(
          `SELECT w.week_id
           FROM weeks w
           WHERE w.course_id = $1
             AND w.opens_at <= now()
             AND w.closes_at > now()
             AND (
               w.scope_type = 'ALL'
               OR EXISTS (
                 SELECT 1 FROM week_teams wt
                 WHERE wt.week_id = w.week_id AND wt.team_key = $2
               )
             )`,
          [courseId, teamKey]
        );

        for (const weekRow of openWeeksResult.rows) {
          const weekId = weekRow.week_id;

          // Get current week_students for this team in this week
          const existingStudentsResult = await client.query(
            `SELECT id, netid_guess, full_name, user_id
             FROM week_students
             WHERE week_id = $1 AND team_key = $2`,
            [weekId, teamKey]
          );
          const existingStudents = existingStudentsResult.rows;
          const existingNetidGuesses = new Set(existingStudents.map((s: any) => s.netid_guess));
          const newNetidGuesses = new Set(newStudents.map(s => s.netid_guess));

          // Find removed students (in existing but not in new upload)
          const removedStudents = existingStudents.filter((s: any) => !newNetidGuesses.has(s.netid_guess));

          // Cancel pending assignments for removed students
          for (const removed of removedStudents) {
            await client.query(
              `UPDATE review_assignments
               SET status = 'CANCELLED'
               WHERE week_id = $1
                 AND status = 'PENDING'
                 AND (
                   reviewee_week_student_id = $2
                   OR reviewer_user_id = $3
                 )`,
              [weekId, removed.id, removed.user_id]
            );
          }

          // Find added students (in new upload but not in existing)
          const addedStudents = newStudents.filter(s => !existingNetidGuesses.has(s.netid_guess));

          // Insert new week_students and create assignments
          const newWeekStudentIds: { id: string; user_id: string | null }[] = [];

          for (const added of addedStudents) {
            // Look up user_id via course_members
            const memberResult = await client.query(
              `SELECT user_id FROM course_members WHERE course_id = $1 AND netid_guess = $2 LIMIT 1`,
              [courseId, added.netid_guess]
            );
            const userId = memberResult.rows[0]?.user_id || null;

            const wsResult = await client.query(
              `INSERT INTO week_students (week_id, team_key, full_name, netid_guess, user_id)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id`,
              [weekId, teamKey, added.full_name, added.netid_guess, userId]
            );
            newWeekStudentIds.push({ id: wsResult.rows[0].id, user_id: userId });
          }

          // Create assignments: new students review existing + existing review new students
          // Get all current (non-removed) week_students for this team
          const allTeamStudentsResult = await client.query(
            `SELECT ws.id, ws.user_id
             FROM week_students ws
             WHERE ws.week_id = $1 AND ws.team_key = $2
               AND ws.id NOT IN (${removedStudents.length > 0 ? removedStudents.map((_: any, i: number) => `$${i + 3}`).join(',') : 'SELECT NULL'})`,
            [weekId, teamKey, ...removedStudents.map((s: any) => s.id)]
          );
          const allTeamStudents = allTeamStudentsResult.rows;

          // For each new student, create assignments with all existing teammates
          for (const newWs of newWeekStudentIds) {
            for (const existingWs of allTeamStudents) {
              if (existingWs.id === newWs.id) continue;

              // New student reviews existing teammate
              if (newWs.user_id) {
                await client.query(
                  `INSERT INTO review_assignments (week_id, reviewer_user_id, reviewee_week_student_id)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (week_id, reviewer_user_id, reviewee_week_student_id) DO NOTHING`,
                  [weekId, newWs.user_id, existingWs.id]
                );
              }

              // Existing teammate reviews new student
              if (existingWs.user_id) {
                await client.query(
                  `INSERT INTO review_assignments (week_id, reviewer_user_id, reviewee_week_student_id)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (week_id, reviewer_user_id, reviewee_week_student_id) DO NOTHING`,
                  [weekId, existingWs.user_id, newWs.id]
                );
              }
            }
          }

          // Add new categories from this upload (don't remove old ones — preserve historical data)
          for (let i = 0; i < parsed.categories.length; i++) {
            const label = parsed.categories[i];
            // Get current max sort_order for this week
            const maxOrderResult = await client.query(
              `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM week_categories WHERE week_id = $1`,
              [weekId]
            );
            const currentMax = maxOrderResult.rows[0].max_order;

            // Only insert if this category label doesn't already exist
            await client.query(
              `INSERT INTO week_categories (week_id, label, sort_order)
               VALUES ($1, $2, $3)
               ON CONFLICT (week_id, label) DO NOTHING`,
              [weekId, label, currentMax + 1]
            );
          }
        }
      }

      return { definition_id, uploaded_at };
    });

    res.status(201).json({
      definition_id: definition.definition_id,
      uploaded_at: definition.uploaded_at,
      teams: parsed.teams,
      categories: parsed.categories,
    });
  } catch (err) {
    console.error('uploadDefinition error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to upload definition' });
  }
}

/**
 * GET /courses/:courseId/definition/current
 * Fetch the current course definition with teams and categories.
 *
 * The "current" definition for each (course, team) is the latest course_definitions
 * upload that contained that team_key. This allows per-team uploads.
 *
 * Returns:
 * {
 *   teams: [{ teamKey, members: [{ fullName, netidGuess, userId }] }],
 *   categories: string[],
 *   uploadedAt: string | null
 * }
 */
export async function getCurrentDefinition(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { courseId } = req.params;

    const result = await withDbNoRLS(async (client) => {
      // For each distinct team_key across all definitions in this course,
      // find the most recently uploaded definition containing that team_key.
      // Then return the students and categories from those definitions.
      const teamDefsResult = await client.query(
        `SELECT DISTINCT ON (ds.team_key)
                ds.team_key,
                cd.definition_id,
                cd.uploaded_at
         FROM definition_students ds
         JOIN course_definitions cd ON cd.definition_id = ds.definition_id
         WHERE cd.course_id = $1
         ORDER BY ds.team_key, cd.uploaded_at DESC`,
        [courseId]
      );

      if (teamDefsResult.rows.length === 0) return null;

      // Latest upload overall (for the uploadedAt field)
      const latestUploadedAt = teamDefsResult.rows.reduce((latest: string | null, row: any) => {
        if (!latest) return row.uploaded_at;
        return new Date(row.uploaded_at) > new Date(latest) ? row.uploaded_at : latest;
      }, null);

      // For each team, get its students from the latest definition for that team
      const teams: Array<{ teamKey: string; members: Array<{ fullName: string; netidGuess: string; userId: string | null }> }> = [];

      for (const teamDef of teamDefsResult.rows) {
        const studentsResult = await client.query(
          `SELECT ds.full_name, ds.netid_guess,
                  cm.user_id
           FROM definition_students ds
           LEFT JOIN course_members cm ON cm.course_id = $1 AND cm.netid_guess = ds.netid_guess
           WHERE ds.definition_id = $2 AND ds.team_key = $3
           ORDER BY ds.full_name`,
          [courseId, teamDef.definition_id, teamDef.team_key]
        );

        teams.push({
          teamKey: teamDef.team_key,
          members: studentsResult.rows.map((s: any) => ({
            fullName: s.full_name,
            netidGuess: s.netid_guess,
            userId: s.user_id || null,
          })),
        });
      }

      // Get categories from the most recent definition overall
      const latestDefResult = await client.query(
        `SELECT definition_id FROM course_definitions WHERE course_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
        [courseId]
      );
      const latestDefId = latestDefResult.rows[0]?.definition_id;
      let categories: string[] = [];
      if (latestDefId) {
        const catResult = await client.query(
          `SELECT label FROM definition_categories WHERE definition_id = $1 ORDER BY sort_order`,
          [latestDefId]
        );
        categories = catResult.rows.map((r: any) => r.label);
      }

      return { teams, categories, uploadedAt: latestUploadedAt };
    });

    if (!result) {
      res.status(404).json({ error: 'not_found', message: 'No definition uploaded yet' });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('getCurrentDefinition error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch definition' });
  }
}

/**
 * POST /courses/:courseId/definition/preview
 * Preview a CSV upload diff without writing to the database.
 * Compares uploaded CSV against current per-team definition.
 */
export async function previewDefinition(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Instructors only' });
      return;
    }

    const { courseId } = req.params;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      res.status(400).json({ error: 'validation', message: 'CSV file is required (field name: file)' });
      return;
    }

    // Verify instructor owns this course
    const courseCheck = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT course_id FROM courses WHERE course_id = $1 AND instructor_user_id = $2`,
        [courseId, req.user.user_id]
      );
      return r.rows[0] || null;
    });

    if (!courseCheck && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Not your course' });
      return;
    }

    // Parse CSV
    let parsed;
    try {
      parsed = parseCsv(file.buffer);
    } catch (parseErr: any) {
      res.status(400).json({ error: 'validation', message: parseErr.message });
      return;
    }

    // Fetch current definition per team
    const diff = await withDbNoRLS(async (client) => {
      const added: { team_key: string; students: string[] }[] = [];
      const removed: { team_key: string; students: string[] }[] = [];
      const unchanged: { team_key: string; count: number }[] = [];

      for (const team of parsed.teams) {
        const teamKey = team.key;
        const newStudentNames = team.students.map(s => s.full_name);
        const newStudentSet = new Set(team.students.map(s => s.netid_guess));

        // Get current students for this team from the latest definition
        const currentResult = await client.query(
          `SELECT ds.full_name, ds.netid_guess
           FROM definition_students ds
           JOIN course_definitions cd ON cd.definition_id = ds.definition_id
           WHERE cd.course_id = $1 AND ds.team_key = $2
           ORDER BY cd.uploaded_at DESC`,
          [courseId, teamKey]
        );

        // Use DISTINCT ON to get only the latest definition for this team
        const latestDefResult = await client.query(
          `SELECT DISTINCT ON (ds.team_key)
                  cd.definition_id
           FROM definition_students ds
           JOIN course_definitions cd ON cd.definition_id = ds.definition_id
           WHERE cd.course_id = $1 AND ds.team_key = $2
           ORDER BY ds.team_key, cd.uploaded_at DESC`,
          [courseId, teamKey]
        );

        let currentStudents: { full_name: string; netid_guess: string }[] = [];
        if (latestDefResult.rows.length > 0) {
          const latestDefId = latestDefResult.rows[0].definition_id;
          const studentsResult = await client.query(
            `SELECT full_name, netid_guess FROM definition_students
             WHERE definition_id = $1 AND team_key = $2`,
            [latestDefId, teamKey]
          );
          currentStudents = studentsResult.rows;
        }

        const currentSet = new Set(currentStudents.map(s => s.netid_guess));

        const addedStudents = team.students
          .filter(s => !currentSet.has(s.netid_guess))
          .map(s => s.full_name);
        const removedStudents = currentStudents
          .filter(s => !newStudentSet.has(s.netid_guess))
          .map(s => s.full_name);
        const unchangedCount = team.students
          .filter(s => currentSet.has(s.netid_guess)).length;

        if (addedStudents.length > 0) {
          added.push({ team_key: teamKey, students: addedStudents });
        }
        if (removedStudents.length > 0) {
          removed.push({ team_key: teamKey, students: removedStudents });
        }
        if (unchangedCount > 0) {
          unchanged.push({ team_key: teamKey, count: unchangedCount });
        }
      }

      return { added, removed, unchanged };
    });

    res.json(diff);
  } catch (err) {
    console.error('previewDefinition error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to preview definition' });
  }
}

/**
 * GET /courses/:courseId/team-analytics
 * Returns aggregate team performance data across all weeks for a course.
 * Instructor only.
 */
export async function getCourseTeamAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Instructors only' });
      return;
    }

    const { courseId } = req.params;

    // Verify instructor owns this course (or is admin)
    const courseCheck = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT course_id FROM courses WHERE course_id = $1 AND instructor_user_id = $2`,
        [courseId, req.user.user_id]
      );
      return r.rows[0] || null;
    });

    if (!courseCheck && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', message: 'Not your course' });
      return;
    }

    const result = await withDbNoRLS(async (client) => {
      // Get all (team, week) rows with aggregate data and completion info
      // Uses week_students for team discovery (works for both ALL and TEAM scope weeks)
      const rowsResult = await client.query(
        `SELECT
          w.week_id,
          w.week_number,
          ws_teams.team_key,
          wta.avg_overall,
          wta.per_category_json,
          wta.n_reviews,
          COUNT(DISTINCT ws.id)::int AS total_students,
          COUNT(DISTINCT CASE
            WHEN ws.user_id IS NOT NULL AND (
              SELECT COUNT(*) FROM review_assignments ra2
              WHERE ra2.reviewer_user_id = ws.user_id AND ra2.week_id = w.week_id AND ra2.status != 'CANCELLED'
            ) > 0 AND (
              SELECT COUNT(*) FROM review_assignments ra3
              WHERE ra3.reviewer_user_id = ws.user_id AND ra3.week_id = w.week_id AND ra3.status = 'SUBMITTED'
            ) = (
              SELECT COUNT(*) FROM review_assignments ra4
              WHERE ra4.reviewer_user_id = ws.user_id AND ra4.week_id = w.week_id AND ra4.status != 'CANCELLED'
            )
            THEN ws.id END
          )::int AS submitted_students
        FROM weeks w
        JOIN (SELECT DISTINCT week_id, team_key FROM week_students) ws_teams ON ws_teams.week_id = w.week_id
        LEFT JOIN week_team_aggregates wta ON wta.week_id = ws_teams.week_id AND wta.team_key = ws_teams.team_key
        LEFT JOIN week_students ws ON ws.week_id = ws_teams.week_id AND ws.team_key = ws_teams.team_key
        WHERE w.course_id = $1
        GROUP BY w.week_id, w.week_number, ws_teams.team_key, wta.avg_overall, wta.per_category_json, wta.n_reviews
        ORDER BY w.week_number, ws_teams.team_key`,
        [courseId]
      );

      // Get distinct category labels across all weeks in this course
      const categoriesResult = await client.query(
        `SELECT DISTINCT wc.label FROM week_categories wc
         JOIN weeks w ON w.week_id = wc.week_id
         WHERE w.course_id = $1
         ORDER BY wc.label`,
        [courseId]
      );

      const rows = rowsResult.rows.map((r: any) => ({
        team_key: r.team_key,
        week_number: r.week_number,
        week_id: r.week_id,
        avg_overall: r.avg_overall !== null ? Number(r.avg_overall) : null,
        per_category_json: r.per_category_json || {},
        n_reviews: r.n_reviews !== null ? Number(r.n_reviews) : 0,
        total_students: r.total_students,
        submitted_students: r.submitted_students,
      }));

      const teams = [...new Set(rows.map((r: any) => r.team_key))].sort();
      const categories = categoriesResult.rows.map((r: any) => r.label);

      return { teams, categories, rows };
    });

    res.json(result);
  } catch (err) {
    console.error('getCourseTeamAnalytics error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch team analytics' });
  }
}

/**
 * GET /courses/:courseId/definitions
 * List all uploaded definitions for a course (summary only, for history view).
 */
export async function listDefinitions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { courseId } = req.params;

    const rows = await withDbNoRLS(async (client) => {
      const r = await client.query(
        `SELECT cd.definition_id, cd.uploaded_at,
                u.name AS uploaded_by_name,
                COUNT(DISTINCT ds.team_key)::int AS team_count,
                COUNT(DISTINCT ds.id)::int AS student_count,
                COUNT(DISTINCT dc.id)::int AS category_count
         FROM course_definitions cd
         JOIN users u ON u.user_id = cd.uploaded_by
         LEFT JOIN definition_students ds ON ds.definition_id = cd.definition_id
         LEFT JOIN definition_categories dc ON dc.definition_id = cd.definition_id
         WHERE cd.course_id = $1
         GROUP BY cd.definition_id, cd.uploaded_at, u.name
         ORDER BY cd.uploaded_at DESC`,
        [courseId]
      );
      return r.rows;
    });

    res.json(rows);
  } catch (err) {
    console.error('listDefinitions error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list definitions' });
  }
}
