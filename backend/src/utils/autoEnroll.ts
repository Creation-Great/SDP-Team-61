import { withDbNoRLS } from '../db.js';

/**
 * Auto-enroll a user in all courses where their netid prefix matches definition_students.
 * Called after both CAS login and email login.
 *
 * @param userId - The user's UUID
 * @param netidPrefix - The first 3 chars of the user's netid (e.g. "alw" from "alw12345")
 *
 * CRITICAL: Always pass netid.slice(0, 3), never the full netid.
 * Email-only accounts (netid = null) must not call this function.
 *
 * Uses the latest-per-team definition logic:
 * For each course, the "current" entry for a team is the most recent
 * course_definitions upload that contained that team_key.
 */
export async function autoEnroll(userId: string, netidPrefix: string): Promise<void> {
  if (!netidPrefix || netidPrefix.length === 0) return;

  await withDbNoRLS(async (client) => {
    // Find all courses where this netid_guess appears in ANY definition_students row,
    // but only consider the latest definition per team_key per course.
    const matchResult = await client.query(
      `SELECT DISTINCT ON (ds.team_key, cd.course_id)
              ds.id AS ds_id,
              ds.definition_id,
              ds.team_key,
              ds.full_name,
              ds.netid_guess,
              cd.course_id
       FROM definition_students ds
       JOIN course_definitions cd ON cd.definition_id = ds.definition_id
       WHERE ds.netid_guess = $1
       ORDER BY ds.team_key, cd.course_id, cd.uploaded_at DESC`,
      [netidPrefix]
    );

    for (const row of matchResult.rows) {
      const { course_id, team_key, full_name, netid_guess } = row;

      // a. Upsert course_members
      await client.query(
        `INSERT INTO course_members (course_id, user_id, team_key, full_name, netid_guess)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (course_id, user_id) DO UPDATE
           SET team_key = EXCLUDED.team_key,
               full_name = EXCLUDED.full_name,
               netid_guess = EXCLUDED.netid_guess`,
        [course_id, userId, team_key, full_name, netid_guess]
      );

      // b. Update week_students.user_id for this course
      await client.query(
        `UPDATE week_students
         SET user_id = $1
         WHERE netid_guess = $2
           AND week_id IN (SELECT week_id FROM weeks WHERE course_id = $3)
           AND user_id IS NULL`,
        [userId, netid_guess, course_id]
      );

      // c. Create missing review_assignments for open weeks
      //    Get all weeks for this course where user now appears as a week_student
      const weekStudentsResult = await client.query(
        `SELECT ws.id AS ws_id, ws.week_id, ws.team_key, ws.user_id
         FROM week_students ws
         JOIN weeks w ON w.week_id = ws.week_id
         WHERE w.course_id = $1
           AND ws.netid_guess = $2`,
        [course_id, netid_guess]
      );

      for (const wsRow of weekStudentsResult.rows) {
        const { ws_id, week_id } = wsRow;

        // Get all teammates in the same team and week who have a user_id
        const teammatesResult = await client.query(
          `SELECT ws2.id AS ws2_id, ws2.user_id AS teammate_user_id
           FROM week_students ws2
           WHERE ws2.week_id = $1
             AND ws2.team_key = $2
             AND ws2.id != $3`,
          [week_id, team_key, ws_id]
        );

        for (const tm of teammatesResult.rows) {
          const { ws2_id, teammate_user_id } = tm;

          // This user reviews teammate
          await client.query(
            `INSERT INTO review_assignments (week_id, reviewer_user_id, reviewee_week_student_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (week_id, reviewer_user_id, reviewee_week_student_id) DO NOTHING`,
            [week_id, userId, ws2_id]
          );

          // Teammate reviews this user (only if teammate has user_id)
          if (teammate_user_id) {
            await client.query(
              `INSERT INTO review_assignments (week_id, reviewer_user_id, reviewee_week_student_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (week_id, reviewer_user_id, reviewee_week_student_id) DO NOTHING`,
              [week_id, teammate_user_id, ws_id]
            );
          }
        }
      }
    }
  });
}
