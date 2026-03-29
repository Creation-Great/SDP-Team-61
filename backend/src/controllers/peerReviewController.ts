import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import { AppError } from '../utils/AppError.js';
import { getGroupForCourse, getTeammatesByCourse } from '../utils/enrollment.js';
import { emitSseEvent } from '../utils/sse.js';
import { logger } from '../utils/logger.js';
import { createNotification } from '../utils/notifications.js';
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
 * POST /peer-review/sessions/:sessionId/duplicate
 * Instructor duplicates a session's metadata into a new closed session.
 */
export async function duplicateSession(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawSessionId = req.params.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  const duplicated = await withDb(user_id, role, async (client) => {
    const source = await client.query(
      `SELECT title, course_id, deadline
       FROM peer_review_sessions
       WHERE session_id = $1`,
      [sessionId]
    );
    if (source.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    const base = source.rows[0];
    const result = await client.query(
      `INSERT INTO peer_review_sessions
         (title, created_by, course_id, deadline, is_open, scores_released, closed_at)
       VALUES ($1, $2, $3, $4, false, false, now())
       RETURNING *`,
      [`${base.title} (Copy)`, user_id, base.course_id, base.deadline]
    );

    await audit(client, user_id, 'DUPLICATE_PR_SESSION', 'peer_review_session', result.rows[0].session_id, {
      source_session_id: sessionId,
    });

    return result.rows[0];
  });

  res.status(201).json(duplicated);
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
      // Students see open sessions AND closed sessions with released scores
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
         WHERE s.is_open = true OR s.scores_released = true
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
        const hasSubmitted = parseInt(myReviews.rows[0].cnt) > 0;
        s.my_submitted = hasSubmitted;

        // Lazy deadline reminders: create in-app notification at 24h / 1h windows.
        if (!hasSubmitted && s.is_open && s.deadline) {
          const now = Date.now();
          const deadlineMs = new Date(s.deadline).getTime();
          const diffMs = deadlineMs - now;
          const oneHour = 60 * 60 * 1000;
          const twentyFourHours = 24 * oneHour;
          const windows = [
            { key: '24h', lower: twentyFourHours - oneHour, upper: twentyFourHours },
            { key: '1h', lower: oneHour - 15 * 60 * 1000, upper: oneHour },
          ];

          for (const w of windows) {
            if (diffMs <= w.upper && diffMs >= w.lower) {
              const reminderLink = `/peer-review/${s.session_id}?deadline_reminder=${w.key}`;
              const exists = await client.query(
                `SELECT 1 FROM notifications
                 WHERE user_id = $1
                   AND type = 'deadline'
                   AND link = $2
                 LIMIT 1`,
                [user_id, reminderLink]
              );
              if (exists.rows.length === 0) {
                await createNotification(client, {
                  userId: user_id,
                  type: 'deadline',
                  title: `Peer review deadline in ${w.key}`,
                  body: `Session "${s.title}" is due soon. Submit your review before the deadline.`,
                  link: reminderLink,
                });
              }
            }
          }
        }
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
 * Update session state/metadata (is_open, title, deadline). Instructor only.
 */
export async function toggleSession(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawSessionId = req.params.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const { is_open, title, deadline } = req.body;

  const session = await withDb(user_id, role, async (client) => {
    const existing = await client.query(
      `SELECT session_id, title, deadline, is_open,
              (SELECT COUNT(*)::int FROM peer_reviews pr WHERE pr.session_id = s.session_id) AS review_count
       FROM peer_review_sessions s
       WHERE session_id = $1`,
      [sessionId]
    );
    if (existing.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }
    const current = existing.rows[0];
    const hasSubmittedReviews = Number(current.review_count) > 0;

    let parsedDeadline: Date | null | undefined = undefined;
    if (deadline !== undefined) {
      parsedDeadline = deadline ? new Date(deadline) : null;
      if (parsedDeadline && Number.isNaN(parsedDeadline.getTime())) {
        throw new AppError(400, 'Invalid deadline');
      }
    }
    if (hasSubmittedReviews && parsedDeadline && current.deadline) {
      const oldMs = new Date(current.deadline).getTime();
      const newMs = parsedDeadline.getTime();
      if (newMs < oldMs) {
        throw new AppError(400, 'Cannot shorten deadline after reviews are submitted');
      }
    }

    const updates: string[] = [];
    const params: Array<string | boolean | Date | null> = [];
    let idx = 1;
    if (is_open !== undefined) {
      updates.push(`is_open = $${idx++}`);
      params.push(is_open);
      updates.push(`closed_at = CASE WHEN $${idx - 1} = false THEN now() ELSE NULL END`);
    }
    if (title !== undefined) {
      updates.push(`title = $${idx++}`);
      params.push(title.trim());
    }
    if (parsedDeadline !== undefined) {
      updates.push(`deadline = $${idx++}`);
      params.push(parsedDeadline);
    }
    if (updates.length === 0) {
      throw new AppError(400, 'No valid fields to update');
    }

    params.push(sessionId);
    const result = await client.query(
      `UPDATE peer_review_sessions
       SET ${updates.join(', ')}
       WHERE session_id = $${idx}
       RETURNING *`,
      params
    );

    const action = is_open !== undefined
      ? (is_open ? 'OPEN_PR_SESSION' : 'CLOSE_PR_SESSION')
      : 'UPDATE_PR_SESSION';
    await audit(client, user_id, action, 'peer_review_session', sessionId, {
      title_updated: title !== undefined,
      deadline_updated: parsedDeadline !== undefined,
    });

    return result.rows[0];
  });

  res.json(session);
}

/**
 * PATCH /peer-review/sessions/:sessionId/release-scores
 * Toggle scores_released flag. Instructor only.
 */
export async function releaseScores(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawSessionId = req.params.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const { scores_released } = req.body;

  const session = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `UPDATE peer_review_sessions
       SET scores_released = $1
       WHERE session_id = $2
       RETURNING *`,
      [scores_released, sessionId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    await audit(client, user_id, scores_released ? 'RELEASE_SCORES' : 'HIDE_SCORES',
      'peer_review_session', sessionId, {});

    return result.rows[0];
  });

  logger.info(
    { action: scores_released ? 'scores_released' : 'scores_hidden', userId: user_id, sessionId },
    scores_released ? 'Peer review scores released' : 'Peer review scores hidden'
  );
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
    await client.query(
      `DELETE FROM peer_review_drafts WHERE session_id = $1 AND reviewer_id = $2`,
      [sessionId, user_id]
    );
  });

  res.json({ message: 'Peer reviews submitted successfully' });

  // Emit SSE event after response — non-blocking
  const sseChannel = req.user.course_id ? `course:${req.user.course_id}` : `instructor:global`;
  emitSseEvent(sseChannel, 'peer_review_submitted', {
    session_id: sessionId,
    reviewer_name: req.user.name,
    review_count: reviews.length,
  });
}

/**
 * GET /peer-review/sessions/:sessionId/draft
 * Get backend-saved peer review draft for current reviewer.
 */
export async function getPeerReviewDraft(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const row = await withDb(user_id, role, async (client) => {
    const session = await client.query(
      `SELECT session_id FROM peer_review_sessions WHERE session_id = $1`,
      [sessionId]
    );
    if (session.rows.length === 0) throw new AppError(404, 'Session not found');

    const result = await client.query(
      `SELECT payload, updated_at
       FROM peer_review_drafts
       WHERE session_id = $1 AND reviewer_id = $2`,
      [sessionId, user_id]
    );
    return result.rows[0] || null;
  });

  if (!row) {
    res.json({ payload: { reviews: {}, teamChemistry: null }, updated_at: null });
    return;
  }
  res.json(row);
}

/**
 * PATCH /peer-review/sessions/:sessionId/draft
 * Save backend peer review draft.
 */
export async function upsertPeerReviewDraft(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;
  const { reviews, teamChemistry } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const session = await client.query(
      `SELECT session_id, is_open FROM peer_review_sessions WHERE session_id = $1`,
      [sessionId]
    );
    if (session.rows.length === 0) throw new AppError(404, 'Session not found');
    if (!session.rows[0].is_open) throw new AppError(400, 'This review session is closed');

    const payload = JSON.stringify({
      reviews: reviews || {},
      teamChemistry: teamChemistry ?? null,
    });
    const result = await client.query(
      `INSERT INTO peer_review_drafts (session_id, reviewer_id, payload, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (session_id, reviewer_id)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
       RETURNING payload, updated_at`,
      [sessionId, user_id, payload]
    );
    return result.rows[0];
  });

  res.json(row);
}

/**
 * GET /peer-review/sessions/:sessionId/results
 * Instructor gets aggregated results + raw details + completion status.
 */
export async function getSessionResults(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;
  const anonymized = String(req.query.anonymized || '').toLowerCase() === 'true';

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

    const detailRows = details.rows;
    if (anonymized) {
      const reviewerMap = new Map<string, string>();
      let seq = 1;
      for (const row of detailRows) {
        const key = String(row.reviewer_name || '');
        if (!reviewerMap.has(key)) {
          reviewerMap.set(key, `Reviewer #${seq}`);
          seq += 1;
        }
      }
      for (const row of detailRows) {
        row.reviewer_name = reviewerMap.get(String(row.reviewer_name || '')) || 'Reviewer';
      }
    }

    return {
      session: session.rows[0],
      averages: averages.rows,
      details: detailRows,
      completion: completion.rows,
      anonymized,
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
    const submittedSet = new Set(reviews.rows.map((r: { reviewer_id: string }) => r.reviewer_id));

    // Privacy: only return the current user's own review details.
    // Other students should only see completion status (who submitted),
    // NOT individual scores or comments from other reviewers.
    const myReviews = reviews.rows.filter((r: { reviewer_id: string }) => r.reviewer_id === user_id);
    const myChemistry = chemistry.rows.filter((c: { reviewer_id: string }) => c.reviewer_id === user_id);

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
  const group = req.query.group as string | undefined;
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;
  const anonymized = String(req.query.anonymized || '').toLowerCase() === 'true';

  const data = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT *
       FROM v_peer_review_averages
       WHERE session_id = $1
         AND ($2::text IS NULL OR team = $2)
         AND ($3::timestamptz IS NULL OR EXISTS (
           SELECT 1 FROM peer_reviews pr
           WHERE pr.session_id = v_peer_review_averages.session_id
             AND pr.reviewee_id = v_peer_review_averages.reviewee_id
             AND pr.updated_at >= $3::timestamptz
         ))
         AND ($4::timestamptz IS NULL OR EXISTS (
           SELECT 1 FROM peer_reviews pr
           WHERE pr.session_id = v_peer_review_averages.session_id
             AND pr.reviewee_id = v_peer_review_averages.reviewee_id
             AND pr.updated_at <= $4::timestamptz
         ))
       ORDER BY team, student_name`,
      [sessionId, group || null, startDate || null, endDate || null]
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB row shape for CSV export
  const rows = data.map((r: Record<string, any>) =>
    [
      escape(anonymized ? '' : (r.team || '')),
      escape(anonymized ? '' : (r.student_name || '')),
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

/**
 * POST /peer-review/sessions/:sessionId/instructor-review
 * Instructor submits reviews for students in any team. No group/team restriction.
 */
export async function submitInstructorReview(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawSessionId = req.params.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const { reviews } = req.body;

  await withDb(user_id, role, async (client) => {
    // Verify session exists
    const session = await client.query(
      'SELECT session_id, course_id FROM peer_review_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (session.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    // Upsert each review — is_self is always false for instructor reviews
    for (const r of reviews) {
      await client.query(
        `INSERT INTO peer_reviews
           (session_id, reviewer_id, reviewee_id, is_self,
            technical_contributions, team_interactions, project_management, individual_comments)
         VALUES ($1, $2, $3, false, $4, $5, $6, $7)
         ON CONFLICT (session_id, reviewer_id, reviewee_id)
         DO UPDATE SET
           technical_contributions = EXCLUDED.technical_contributions,
           team_interactions = EXCLUDED.team_interactions,
           project_management = EXCLUDED.project_management,
           individual_comments = EXCLUDED.individual_comments,
           updated_at = now()`,
        [sessionId, user_id, r.reviewee_id,
         r.technical_contributions, r.team_interactions, r.project_management,
         r.individual_comments || '']
      );
    }

    await audit(client, user_id, 'INSTRUCTOR_SUBMIT_PEER_REVIEWS', 'peer_review_session', sessionId, {
      review_count: reviews.length,
    });
  });

  res.json({ message: 'Instructor reviews submitted successfully' });
}

/**
 * GET /peer-review/sessions/:sessionId/bias-analytics
 * Self vs peer score comparison — detect scoring bias.
 */
export async function getBiasAnalytics(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const data = await withDb(user_id, role, async (client) => {
    // For each student: compute self-given scores vs peer-given scores
    const result = await client.query(
      `SELECT
         u.user_id,
         u.name AS student_name,
         COALESCE(ue.group_id, u.group_id) AS team,

         -- Self-review scores (where reviewer = reviewee)
         AVG(CASE WHEN pr.is_self THEN pr.technical_contributions END)::numeric(4,2) AS self_technical,
         AVG(CASE WHEN pr.is_self THEN pr.team_interactions END)::numeric(4,2)       AS self_interactions,
         AVG(CASE WHEN pr.is_self THEN pr.project_management END)::numeric(4,2)      AS self_management,

         -- Peer-review scores (where reviewer != reviewee)
         AVG(CASE WHEN NOT pr.is_self THEN pr.technical_contributions END)::numeric(4,2) AS peer_technical,
         AVG(CASE WHEN NOT pr.is_self THEN pr.team_interactions END)::numeric(4,2)       AS peer_interactions,
         AVG(CASE WHEN NOT pr.is_self THEN pr.project_management END)::numeric(4,2)      AS peer_management,

         -- Overall averages
         AVG(CASE WHEN pr.is_self THEN (pr.technical_contributions + pr.team_interactions + pr.project_management) / 3.0 END)::numeric(4,2) AS self_avg,
         AVG(CASE WHEN NOT pr.is_self THEN (pr.technical_contributions + pr.team_interactions + pr.project_management) / 3.0 END)::numeric(4,2) AS peer_avg,

         COUNT(*) FILTER (WHERE pr.is_self) AS self_review_count,
         COUNT(*) FILTER (WHERE NOT pr.is_self) AS peer_review_count

       FROM peer_reviews pr
       JOIN users u ON u.user_id = pr.reviewee_id
       LEFT JOIN user_enrollments ue ON ue.user_id = u.user_id
         AND ue.course_id = (SELECT course_id FROM peer_review_sessions WHERE session_id = $1)
       WHERE pr.session_id = $1
       GROUP BY u.user_id, u.name, COALESCE(ue.group_id, u.group_id)
       ORDER BY COALESCE(ue.group_id, u.group_id), u.name`,
      [sessionId]
    );

    // Add bias metric: self_avg - peer_avg
    const analytics = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      bias: r.self_avg != null && r.peer_avg != null
        ? parseFloat((Number(r.self_avg) - Number(r.peer_avg)).toFixed(2))
        : null,
    }));

    return analytics;
  });

  res.json(data);
}

/**
 * GET /peer-review/sessions/:sessionId/student-scores
 * Student endpoint: returns their own average scores ONLY if scores are released.
 */
export async function getStudentScores(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const data = await withDb(user_id, role, async (client) => {
    // Check if scores are released
    const session = await client.query(
      'SELECT session_id, title, scores_released FROM peer_review_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (session.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    if (!session.rows[0].scores_released) {
      return { released: false, session: session.rows[0], scores: null };
    }

    // Get this student's aggregated scores
    const scores = await client.query(
      `SELECT * FROM v_peer_review_averages
       WHERE session_id = $1 AND reviewee_id = $2`,
      [sessionId, user_id]
    );

    return {
      released: true,
      session: session.rows[0],
      scores: scores.rows[0] || null,
    };
  });

  res.json(data);
}

/**
 * GET /peer-review/sessions/:sessionId/all-students
 * Instructor endpoint: returns all students in the session's course for the consolidated review page.
 */
export async function getAllStudentsForSession(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { sessionId } = req.params;

  const data = await withDb(user_id, role, async (client) => {
    const session = await client.query(
      'SELECT session_id, title, course_id, is_open FROM peer_review_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (session.rows.length === 0) {
      throw new AppError(404, 'Session not found');
    }

    const courseId = session.rows[0].course_id;

    // Get all students in this course
    const students = courseId
      ? await client.query(
          `SELECT u.user_id, u.name, u.email, COALESCE(ue.group_id, u.group_id) AS group_id
           FROM users u
           LEFT JOIN user_enrollments ue ON ue.user_id = u.user_id AND ue.course_id = $1
           WHERE u.role = 'student'
             AND (ue.enrollment_id IS NOT NULL OR u.course_id = $1)
           ORDER BY COALESCE(ue.group_id, u.group_id), u.name`,
          [courseId]
        )
      : await client.query(
          `SELECT u.user_id, u.name, u.email, u.group_id
           FROM users u WHERE u.role = 'student'
           ORDER BY u.group_id, u.name`
        );

    // Get existing instructor reviews for this session
    const existingReviews = await client.query(
      `SELECT reviewee_id, technical_contributions, team_interactions,
              project_management, individual_comments
       FROM peer_reviews
       WHERE session_id = $1 AND reviewer_id = $2`,
      [sessionId, user_id]
    );

    return {
      session: session.rows[0],
      students: students.rows,
      existingReviews: existingReviews.rows,
    };
  });

  res.json(data);
}

/**
 * POST /peer-review/appeals
 * Student creates clarification/appeal request for a session/review/comment.
 */
export async function createAppeal(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { session_id, target_type, target_id, message } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const session = await client.query(
      `SELECT session_id, title, created_by FROM peer_review_sessions WHERE session_id = $1`,
      [session_id]
    );
    if (session.rows.length === 0) throw new AppError(404, 'Session not found');

    const result = await client.query(
      `INSERT INTO peer_review_appeals
         (session_id, student_id, target_type, target_id, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [session_id, user_id, target_type || 'session', target_id || null, message.trim()]
    );

    await audit(client, user_id, 'CREATE_PEER_REVIEW_APPEAL', 'peer_review_appeal', result.rows[0].appeal_id, {
      session_id,
      target_type: target_type || 'session',
    });

    const instructorId = session.rows[0].created_by;
    if (instructorId) {
      await createNotification(client, {
        userId: instructorId,
        type: 'system',
        title: 'New peer-review clarification request',
        body: `A student submitted a clarification request in "${session.rows[0].title}".`,
        link: '/instructor/analytics',
      });
    }

    return result.rows[0];
  });

  res.status(201).json(row);
}

/**
 * GET /peer-review/appeals/mine
 * Student lists own appeals.
 */
export async function getMyAppeals(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT a.*, s.title AS session_title
       FROM peer_review_appeals a
       JOIN peer_review_sessions s ON s.session_id = a.session_id
       WHERE a.student_id = $1
       ORDER BY a.created_at DESC`,
      [user_id]
    );
    return result.rows;
  });

  res.json(rows);
}

/**
 * GET /peer-review/appeals
 * Instructor lists appeals across their created sessions.
 */
export async function getAppealsForInstructor(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const status = req.query.status as string | undefined;

  const rows = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT a.*, s.title AS session_title, u.name AS student_name
       FROM peer_review_appeals a
       JOIN peer_review_sessions s ON s.session_id = a.session_id
       JOIN users u ON u.user_id = a.student_id
       WHERE s.created_by = $1
         AND ($2::text IS NULL OR a.status = $2)
       ORDER BY a.created_at DESC`,
      [user_id, status || null]
    );
    return result.rows;
  });

  res.json(rows);
}

/**
 * PATCH /peer-review/appeals/:appealId
 * Instructor updates status/reply.
 */
export async function updateAppealByInstructor(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const rawAppealId = req.params.appealId;
  const appealId = Array.isArray(rawAppealId) ? rawAppealId[0] : rawAppealId;
  const { status, instructor_reply } = req.body;

  const row = await withDb(user_id, role, async (client) => {
    const check = await client.query(
      `SELECT a.appeal_id, a.student_id, a.session_id, s.created_by, s.title
       FROM peer_review_appeals a
       JOIN peer_review_sessions s ON s.session_id = a.session_id
       WHERE a.appeal_id = $1`,
      [appealId]
    );
    if (check.rows.length === 0) throw new AppError(404, 'Appeal not found');
    if (check.rows[0].created_by !== user_id) throw new AppError(403, 'You can only process appeals for your sessions');

    const result = await client.query(
      `UPDATE peer_review_appeals
       SET status = $1, instructor_reply = $2, updated_at = now()
       WHERE appeal_id = $3
       RETURNING *`,
      [status, instructor_reply || '', appealId]
    );

    await audit(client, user_id, 'UPDATE_PEER_REVIEW_APPEAL', 'peer_review_appeal', appealId, {
      status,
    });

    await createNotification(client, {
      userId: check.rows[0].student_id,
      type: 'system',
      title: 'Your clarification request was updated',
      body: `Request in "${check.rows[0].title}" is now ${status}.`,
      link: `/peer-review/${check.rows[0].session_id}/my-scores`,
    });

    return result.rows[0];
  });

  res.json(row);
}
