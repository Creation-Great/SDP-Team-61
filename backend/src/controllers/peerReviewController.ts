import { Response } from 'express';
import { withDb } from '../db.js';
import { audit } from '../utils/audit.js';
import type { AuthRequest } from '../types.js';

/**
 * POST /peer-review/sessions
 * Instructor creates a new peer review session.
 */
export async function createSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { title, course_id } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'validation', message: 'Title is required' });
      return;
    }

    const session = await withDb(user_id, role, async (client) => {
      const result = await client.query(
        `INSERT INTO peer_review_sessions (title, created_by, course_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [title.trim(), user_id, course_id || null]
      );

      await audit(client, user_id, 'CREATE_PR_SESSION', 'peer_review_session', result.rows[0].session_id, {
        title: title.trim(),
      });

      return result.rows[0];
    });

    res.status(201).json(session);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Create session error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create session' });
  }
}

/**
 * GET /peer-review/sessions
 * List all peer review sessions. Both students and instructors can view.
 */
export async function getSessions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;

    const sessions = await withDb(user_id, role, async (client) => {
      const result = await client.query(
        `SELECT s.*,
                u.name AS created_by_name,
                (SELECT COUNT(DISTINCT pr.reviewer_id)
                 FROM peer_reviews pr
                 WHERE pr.session_id = s.session_id) AS submitted_count
         FROM peer_review_sessions s
         JOIN users u ON u.user_id = s.created_by
         ORDER BY s.created_at DESC`
      );

      // For students: also indicate whether they have already submitted
      if (role === 'student') {
        for (const s of result.rows) {
          const myReviews = await client.query(
            `SELECT COUNT(*) AS cnt FROM peer_reviews
             WHERE session_id = $1 AND reviewer_id = $2`,
            [s.session_id, user_id]
          );
          s.my_submitted = parseInt(myReviews.rows[0].cnt) > 0;
        }
      }

      return result.rows;
    });

    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch sessions' });
  }
}

/**
 * PATCH /peer-review/sessions/:sessionId
 * Toggle session open/closed. Instructor only.
 */
export async function toggleSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { sessionId } = req.params;
    const { is_open } = req.body;

    if (typeof is_open !== 'boolean') {
      res.status(400).json({ error: 'validation', message: 'is_open (boolean) is required' });
      return;
    }

    const session = await withDb(user_id, role, async (client) => {
      const result = await client.query(
        `UPDATE peer_review_sessions
         SET is_open = $1, closed_at = CASE WHEN $1 = false THEN now() ELSE NULL END
         WHERE session_id = $2
         RETURNING *`,
        [is_open, sessionId]
      );

      if (result.rows.length === 0) {
        throw { status: 404, message: 'Session not found' };
      }

      await audit(client, user_id, is_open ? 'OPEN_PR_SESSION' : 'CLOSE_PR_SESSION',
        'peer_review_session', sessionId, {});

      return result.rows[0];
    });

    res.json(session);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Toggle session error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update session' });
  }
}

/**
 * GET /peer-review/sessions/:sessionId/my-team
 * Get teammates for the review form. Student endpoint.
 */
export async function getMyTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { sessionId } = req.params;

    const data = await withDb(user_id, role, async (client) => {
      // Check session exists and is open
      const session = await client.query(
        'SELECT session_id, title, is_open FROM peer_review_sessions WHERE session_id = $1',
        [sessionId]
      );
      if (session.rows.length === 0) {
        throw { status: 404, message: 'Session not found' };
      }

      // Get user's group_id
      const me = await client.query('SELECT group_id FROM users WHERE user_id = $1', [user_id]);
      const groupId = me.rows[0]?.group_id;

      if (!groupId) {
        throw { status: 400, message: 'You are not assigned to a team. Please update your profile with a team number.' };
      }

      // Get all team members (including self)
      const teammates = await client.query(
        `SELECT user_id, name, email FROM users
         WHERE group_id = $1 AND role = 'student'
         ORDER BY name`,
        [groupId]
      );

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
        teammates: teammates.rows,
        existingReviews: existing.rows,
        teamChemistry: chemistry.rows[0]?.score || null,
        groupId,
      };
    });

    res.json(data);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Get my team error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to load team data' });
  }
}

/**
 * POST /peer-review/sessions/:sessionId/submit
 * Submit all peer reviews + team chemistry atomically.
 */
export async function submitPeerReviews(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { sessionId } = req.params;
    const { reviews, teamChemistry } = req.body;

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      res.status(400).json({ error: 'validation', message: 'Reviews array is required' });
      return;
    }

    // Validate each review entry
    for (const r of reviews) {
      if (!r.reviewee_id) {
        res.status(400).json({ error: 'validation', message: 'Each review must have a reviewee_id' });
        return;
      }
      const scores = [r.technical_contributions, r.team_interactions, r.project_management];
      for (const s of scores) {
        if (s === undefined || s === null || s < 1 || s > 5) {
          res.status(400).json({ error: 'validation', message: 'All scores must be between 1 and 5' });
          return;
        }
      }
    }

    if (teamChemistry !== undefined && teamChemistry !== null) {
      if (teamChemistry < 1 || teamChemistry > 5) {
        res.status(400).json({ error: 'validation', message: 'Team chemistry must be between 1 and 5' });
        return;
      }
    }

    await withDb(user_id, role, async (client) => {
      // Verify session is open
      const session = await client.query(
        'SELECT is_open FROM peer_review_sessions WHERE session_id = $1',
        [sessionId]
      );
      if (session.rows.length === 0) {
        throw { status: 404, message: 'Session not found' };
      }
      if (!session.rows[0].is_open) {
        throw { status: 400, message: 'This review session is closed' };
      }

      // Verify reviewer belongs to a team
      const me = await client.query('SELECT group_id FROM users WHERE user_id = $1', [user_id]);
      if (!me.rows[0]?.group_id) {
        throw { status: 400, message: 'You are not assigned to a team' };
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
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Submit peer reviews error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to submit peer reviews' });
  }
}

/**
 * GET /peer-review/sessions/:sessionId/results
 * Instructor gets aggregated results + raw details + completion status.
 */
export async function getSessionResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { user_id, role } = req.user;
    const { sessionId } = req.params;

    const data = await withDb(user_id, role, async (client) => {
      // Session info
      const session = await client.query(
        `SELECT s.*, u.name AS created_by_name
         FROM peer_review_sessions s
         JOIN users u ON u.user_id = s.created_by
         WHERE s.session_id = $1`,
        [sessionId]
      );
      if (session.rows.length === 0) {
        throw { status: 404, message: 'Session not found' };
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

      // Completion status per team
      const completion = await client.query(
        `SELECT
           u.group_id AS team,
           COUNT(DISTINCT u.user_id) AS team_size,
           COUNT(DISTINCT pr.reviewer_id) AS submitted_count
         FROM users u
         LEFT JOIN peer_reviews pr
           ON pr.reviewer_id = u.user_id AND pr.session_id = $1
         WHERE u.role = 'student' AND u.group_id IS NOT NULL
         GROUP BY u.group_id
         ORDER BY u.group_id`,
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
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Get session results error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch results' });
  }
}

/**
 * GET /peer-review/sessions/:sessionId/export-csv
 * Export aggregated results as CSV download.
 */
export async function exportCsv(req: AuthRequest, res: Response): Promise<void> {
  try {
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
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: 'validation', message: err.message });
      return;
    }
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'internal_error', message: 'Failed to export CSV' });
  }
}
