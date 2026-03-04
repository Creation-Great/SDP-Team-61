import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import { AppError } from '../utils/AppError.js';
import { getGroupForCourse, getTeammatesByCourse } from '../utils/enrollment.js';
import type { AuthRequest } from '../types.js';
import type { PoolClient } from 'pg';

/**
 * Auto-close any sessions whose deadline has passed.
 * Called lazily on read to avoid needing a background scheduler.
 */
async function autoCloseExpiredSessions(client: PoolClient): Promise<void> {
  await client.query(
    `UPDATE peer_review_sessions
     SET is_open = false, closed_at = now()
     WHERE is_open = true AND deadline IS NOT NULL AND deadline <= now()`
  );
}

/**
 * POST /peer-review/sessions
 * Instructor creates a new peer review session.
 */
export async function createSession(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { title, course_id, deadline } = req.body;

  // Auto-fill course_id from the instructor's profile if not provided
  const effectiveCourseId = course_id || req.user.course_id || null;
  const effectiveDeadline = deadline ? new Date(deadline) : null;

  // Validate deadline is in the future
  if (effectiveDeadline && effectiveDeadline <= new Date()) {
    throw new AppError(400, 'Deadline must be in the future');
  }

  const session = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO peer_review_sessions (title, created_by, course_id, deadline)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title.trim(), user_id, effectiveCourseId, effectiveDeadline]
    );

    await audit(client, user_id, 'CREATE_PR_SESSION', 'peer_review_session', result.rows[0].session_id, {
      title: title.trim(),
    });

    return result.rows[0];
  });

  res.status(201).json(session);
}

/**
 * GET /peer-review/sessions
 * List all peer review sessions. Both students and instructors can view.
 */
export async function getSessions(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;

  const sessions = await withDb(user_id, role, async (client) => {
    // Auto-close any sessions past their deadline
    await autoCloseExpiredSessions(client);

    // For students: resolve group_id via enrollment (supports multi-course)
    let groupId: string | null = null;
    if (role === 'student') {
      // Use primary enrollment as default scope
      groupId = req.user.group_id || null;
    }

    if (role === 'student') {
      // Students see only open sessions with team-scoped submitted_count
      const result = await client.query(
        `SELECT s.*,
                u.name AS created_by_name,
                (SELECT COUNT(DISTINCT pr.reviewer_id)
                 FROM peer_reviews pr
                 JOIN users ur ON ur.user_id = pr.reviewer_id
                 WHERE pr.session_id = s.session_id
                   AND ur.group_id = $1) AS submitted_count,
                (SELECT COUNT(DISTINCT tu.user_id)
                 FROM users tu
                 WHERE tu.group_id = $1 AND tu.role = 'student') AS team_size
         FROM peer_review_sessions s
         LEFT JOIN users u ON u.user_id = s.created_by
         WHERE s.is_open = true
         ORDER BY s.created_at DESC`,
        [groupId]
      );

      // Also indicate whether they have already submitted
      for (const s of result.rows) {
        const myReviews = await client.query(
          `SELECT COUNT(*) AS cnt FROM peer_reviews
           WHERE session_id = $1 AND reviewer_id = $2`,
          [s.session_id, user_id]
        );
        s.my_submitted = parseInt(myReviews.rows[0].cnt) > 0;
      }

      return result.rows;
    } else {
      // Instructors see global submitted_count (all teams)
      const result = await client.query(
        `SELECT s.*,
                u.name AS created_by_name,
                (SELECT COUNT(DISTINCT pr.reviewer_id)
                 FROM peer_reviews pr
                 WHERE pr.session_id = s.session_id) AS submitted_count,
                (SELECT COUNT(DISTINCT tu.user_id)
                 FROM users tu
                 LEFT JOIN user_enrollments ue ON ue.user_id = tu.user_id AND ue.course_id = s.course_id
                 WHERE tu.role = 'student'
                   AND (s.course_id IS NULL OR ue.enrollment_id IS NOT NULL)) AS team_size
         FROM peer_review_sessions s
         LEFT JOIN users u ON u.user_id = s.created_by
         ORDER BY s.created_at DESC`
      );
      return result.rows;
    }
  });

  res.json(sessions);
}

/**
 * PATCH /peer-review/sessions/:sessionId
 * Toggle session open/closed. Instructor only.
 */
export async function toggleSession(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawSessionId = req.params.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const { is_open } = req.body;

  const session = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `UPDATE peer_review_sessions
       SET is_open = $1, closed_at = CASE WHEN $1 = false THEN now() ELSE NULL END
       WHERE session_id = $2
       RETURNING *`,
      [is_open, sessionId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    await audit(client, user_id, is_open ? 'OPEN_PR_SESSION' : 'CLOSE_PR_SESSION',
      'peer_review_session', sessionId, {});

    return result.rows[0];
  });

  res.json(session);
}

/**
 * GET /peer-review/sessions/:sessionId/my-team
 * Get teammates for the review form. Student endpoint.
 */
export async function getMyTeam(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const data = await withDb(user_id, role, async (client) => {
    // Check session exists and is open
    const session = await client.query(
      'SELECT session_id, title, is_open, course_id, deadline FROM peer_review_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (session.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    const sessionCourseId = session.rows[0].course_id;

    // Resolve group_id via enrollment for this session's course
    const groupId = await getGroupForCourse(client, user_id, sessionCourseId);

    if (!groupId) {
      throw new AppError(400, 'You are not assigned to a team. Please contact your instructor to be assigned to a group.');
    }

    // Get all team members via enrollment (course-aware)
    const teammates = await getTeammatesByCourse(client, sessionCourseId, groupId);

    // Get existing reviews by this user for this session
    const existing = await client.query(
      `SELECT reviewee_id, technical_contributions, team_interactions,
              project_management, individual_comments, is_self
       FROM peer_reviews
       WHERE session_id = $1 AND reviewer_id = $2`,
      [sessionId, user_id]
    );

    // Get existing team chemistry
    const chemistry = await client.query(
      `SELECT score FROM peer_review_team_chemistry
       WHERE session_id = $1 AND reviewer_id = $2`,
      [sessionId, user_id]
    );

    return {
      session: session.rows[0],
      teammates,
      existingReviews: existing.rows,
      teamChemistry: chemistry.rows[0]?.score || null,
      groupId,
      authenticatedUserId: user_id,
    };
  });

  res.json(data);
}

/**
 * POST /peer-review/sessions/:sessionId/submit
 * Submit all peer reviews + team chemistry atomically.
 */
export async function submitPeerReviews(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawSessionId = req.params.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const { reviews, teamChemistry } = req.body;

  await withDb(user_id, role, async (client) => {
    // Auto-close expired sessions before checking
    await autoCloseExpiredSessions(client);

    // Verify session is open
    const session = await client.query(
      'SELECT is_open, course_id FROM peer_review_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (session.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }
    if (!session.rows[0].is_open) {
      throw new AppError(400, 'This review session is closed');
    }

    // Verify reviewer belongs to a team (enrollment-aware)
    const groupId = await getGroupForCourse(client, user_id, session.rows[0].course_id);
    if (!groupId) {
      throw new AppError(400, 'You are not assigned to a team');
    }

    // Upsert each review
    for (const r of reviews) {
      const isSelf = r.reviewee_id === user_id;
      await client.query(
        `INSERT INTO peer_reviews
           (session_id, reviewer_id, reviewee_id, is_self,
            technical_contributions, team_interactions, project_management, individual_comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (session_id, reviewer_id, reviewee_id)
         DO UPDATE SET
           technical_contributions = EXCLUDED.technical_contributions,
           team_interactions = EXCLUDED.team_interactions,
           project_management = EXCLUDED.project_management,
           individual_comments = EXCLUDED.individual_comments,
           updated_at = now()`,
        [sessionId, user_id, r.reviewee_id, isSelf,
         r.technical_contributions, r.team_interactions, r.project_management,
         r.individual_comments || '']
      );
    }

    // Upsert team chemistry
    if (teamChemistry !== undefined && teamChemistry !== null) {
      await client.query(
        `INSERT INTO peer_review_team_chemistry (session_id, reviewer_id, score)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id, reviewer_id)
         DO UPDATE SET score = EXCLUDED.score`,
        [sessionId, user_id, teamChemistry]
      );
    }

    await audit(client, user_id, 'SUBMIT_PEER_REVIEWS', 'peer_review_session', sessionId, {
      review_count: reviews.length,
      team_chemistry: teamChemistry,
    });
  });

  res.json({ message: 'Peer reviews submitted successfully' });
}

/**
 * GET /peer-review/sessions/:sessionId/results
 * Instructor gets aggregated results + raw details + completion status.
 */
export async function getSessionResults(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const data = await withDb(user_id, role, async (client) => {
    // Session info
    const session = await client.query(
      `SELECT s.*, u.name AS created_by_name
       FROM peer_review_sessions s
       LEFT JOIN users u ON u.user_id = s.created_by
       WHERE s.session_id = $1`,
      [sessionId]
    );
    if (session.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    // Aggregated averages per student
    const averages = await client.query(
      `SELECT * FROM v_peer_review_averages WHERE session_id = $1 ORDER BY team, student_name`,
      [sessionId]
    );

    // Raw detail data
    const details = await client.query(
      `SELECT
         u_team.group_id AS team,
         u_reviewee.name AS reviewee_name,
         u_reviewer.name AS reviewer_name,
         pr.is_self,
         pr.technical_contributions,
         pr.team_interactions,
         pr.project_management,
         tc.score AS team_chemistry,
         pr.individual_comments
       FROM peer_reviews pr
       JOIN users u_reviewee ON u_reviewee.user_id = pr.reviewee_id
       JOIN users u_reviewer ON u_reviewer.user_id = pr.reviewer_id
       JOIN users u_team ON u_team.user_id = pr.reviewer_id
       LEFT JOIN peer_review_team_chemistry tc
         ON tc.session_id = pr.session_id AND tc.reviewer_id = pr.reviewer_id
       WHERE pr.session_id = $1
       ORDER BY u_team.group_id, u_reviewer.name, u_reviewee.name`,
      [sessionId]
    );

    // Completion status per team (enrollment-aware with fallback)
    const completion = await client.query(
      `SELECT
         COALESCE(ue.group_id, u.group_id) AS team,
         COUNT(DISTINCT u.user_id) AS team_size,
         COUNT(DISTINCT pr.reviewer_id) AS submitted_count
       FROM users u
       LEFT JOIN user_enrollments ue ON ue.user_id = u.user_id
         AND ue.course_id = (SELECT course_id FROM peer_review_sessions WHERE session_id = $1)
       LEFT JOIN peer_reviews pr
         ON pr.reviewer_id = u.user_id AND pr.session_id = $1
       WHERE u.role = 'student' AND COALESCE(ue.group_id, u.group_id) IS NOT NULL
       GROUP BY COALESCE(ue.group_id, u.group_id)
       ORDER BY COALESCE(ue.group_id, u.group_id)`,
      [sessionId]
    );

    return {
      session: session.rows[0],
      averages: averages.rows,
      details: details.rows,
      completion: completion.rows,
    };
  });

  res.json(data);
}

/**
 * GET /peer-review/sessions/:sessionId/team-reviews
 * Students can view all reviews submitted within their own team (real-time sync).
 */
export async function getTeamReviews(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const data = await withDb(user_id, role, async (client) => {
    // Session info (need course_id for enrollment lookup)
    const session = await client.query(
      'SELECT session_id, title, is_open, course_id FROM peer_review_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (session.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    const sessionCourseId = session.rows[0].course_id;

    // Resolve group_id via enrollment for this session's course
    const groupId = await getGroupForCourse(client, user_id, sessionCourseId);

    if (!groupId) {
      throw new AppError(400, 'You are not assigned to a team');
    }

    // All team members via enrollment
    const teammates = await getTeammatesByCourse(client, sessionCourseId, groupId);

    // All reviews within this team for this session
    // Use enrollment join when course_id is available, fallback to users.group_id
    const reviewsQuery = sessionCourseId
      ? `SELECT
           pr.reviewer_id,
           u_reviewer.name AS reviewer_name,
           pr.reviewee_id,
           u_reviewee.name AS reviewee_name,
           pr.is_self,
           pr.technical_contributions,
           pr.team_interactions,
           pr.project_management,
           pr.individual_comments,
           pr.updated_at
         FROM peer_reviews pr
         JOIN users u_reviewer ON u_reviewer.user_id = pr.reviewer_id
         JOIN users u_reviewee ON u_reviewee.user_id = pr.reviewee_id
         LEFT JOIN user_enrollments ue ON ue.user_id = pr.reviewer_id AND ue.course_id = $3
         WHERE pr.session_id = $1
           AND COALESCE(ue.group_id, u_reviewer.group_id) = $2
         ORDER BY u_reviewer.name, u_reviewee.name`
      : `SELECT
           pr.reviewer_id,
           u_reviewer.name AS reviewer_name,
           pr.reviewee_id,
           u_reviewee.name AS reviewee_name,
           pr.is_self,
           pr.technical_contributions,
           pr.team_interactions,
           pr.project_management,
           pr.individual_comments,
           pr.updated_at
         FROM peer_reviews pr
         JOIN users u_reviewer ON u_reviewer.user_id = pr.reviewer_id
         JOIN users u_reviewee ON u_reviewee.user_id = pr.reviewee_id
         WHERE pr.session_id = $1
           AND u_reviewer.group_id = $2
         ORDER BY u_reviewer.name, u_reviewee.name`;

    const reviewParams = sessionCourseId
      ? [sessionId, groupId, sessionCourseId]
      : [sessionId, groupId];
    const reviews = await client.query(reviewsQuery, reviewParams);

    // Team chemistry scores for this team (enrollment-aware)
    const chemistryQuery = sessionCourseId
      ? `SELECT tc.reviewer_id, u.name AS reviewer_name, tc.score
         FROM peer_review_team_chemistry tc
         JOIN users u ON u.user_id = tc.reviewer_id
         LEFT JOIN user_enrollments ue ON ue.user_id = tc.reviewer_id AND ue.course_id = $3
         WHERE tc.session_id = $1
           AND COALESCE(ue.group_id, u.group_id) = $2
         ORDER BY u.name`
      : `SELECT tc.reviewer_id, u.name AS reviewer_name, tc.score
         FROM peer_review_team_chemistry tc
         JOIN users u ON u.user_id = tc.reviewer_id
         WHERE tc.session_id = $1 AND u.group_id = $2
         ORDER BY u.name`;

    const chemistryParams = sessionCourseId
      ? [sessionId, groupId, sessionCourseId]
      : [sessionId, groupId];
    const chemistry = await client.query(chemistryQuery, chemistryParams);

    // Who has submitted (distinct reviewer_ids)
    const submittedSet = new Set(reviews.rows.map((r: any) => r.reviewer_id));

    // Privacy: only return the current user's own review details.
    // Other students should only see completion status (who submitted),
    // NOT individual scores or comments from other reviewers.
    const myReviews = reviews.rows.filter((r: any) => r.reviewer_id === user_id);
    const myChemistry = chemistry.rows.filter((c: any) => c.reviewer_id === user_id);

    return {
      session: session.rows[0],
      teammates,
      reviews: myReviews,
      chemistry: myChemistry,
      submittedReviewerIds: Array.from(submittedSet),
      groupId,
      authenticatedUserId: user_id,
    };
  });

  res.json(data);
}

/**
 * GET /peer-review/sessions/:sessionId/export-csv
 * Export aggregated results as CSV download.
 */
export async function exportCsv(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const data = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT * FROM v_peer_review_averages WHERE session_id = $1 ORDER BY team, student_name`,
      [sessionId]
    );
    return result.rows;
  });

  // Build CSV with proper escaping
  const escape = (val: string) => {
    if (val && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val || '';
  };

  const header = 'Team,Name,Avg Technical Contributions,Avg Team Interactions,Avg Project Management,Avg Team Chemistry,Review Count';
  const rows = data.map((r: any) =>
    [
      escape(r.team || ''),
      escape(r.student_name || ''),
      r.avg_technical ?? '',
      r.avg_interactions ?? '',
      r.avg_management ?? '',
      r.avg_team_chemistry ?? '',
      r.review_count ?? '',
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=peer-review-results-${sessionId}.csv`);
  res.send(csv);
}
