import { Response } from 'express';
import { withDb } from '../db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types.js';

/**
 * GET /lms/:courseId
 */
export async function getLmsConfig(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { courseId } = req.params;

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT id, course_id, provider, api_url, api_key, config_json, created_at, updated_at
       FROM lms_config
       WHERE course_id = $1`,
      [courseId]
    );
    return result.rows[0] || null;
  });

  if (!row) {
    res.status(404).json({ error: 'not_found', message: 'LMS config not found for this course' });
    return;
  }
  res.json(row);
}

/**
 * PUT /lms/:courseId
 * Body: { provider, api_url?, api_key?, config_json? }
 */
export async function upsertLmsConfig(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { courseId } = req.params;
  const { provider, api_url, api_key, config_json } = req.body;

  if (!provider) {
    throw new AppError(400, 'provider is required', 'validation');
  }

  const row = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `INSERT INTO lms_config (course_id, provider, api_url, api_key, config_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (course_id) DO UPDATE SET
         provider = EXCLUDED.provider,
         api_url = EXCLUDED.api_url,
         api_key = EXCLUDED.api_key,
         config_json = EXCLUDED.config_json,
         updated_at = now()
       RETURNING *`,
      [courseId, provider, api_url || null, api_key || null, config_json ? JSON.stringify(config_json) : null]
    );
    return result.rows[0];
  });

  logger.info({ courseId, provider }, 'LMS config upserted');
  res.json(row);
}

/**
 * POST /lms/lti/launch
 * Returns a mock LTI launch response.
 */
export async function mockLtiLaunch(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, email, name, role } = req.user;

  logger.info({ user_id }, 'Mock LTI launch initiated');

  res.json({
    lti_version: 'LTI-1p3',
    message_type: 'LtiResourceLinkRequest',
    resource_link_id: `mock-resource-${Date.now()}`,
    user: {
      id: user_id,
      name,
      email,
      roles: role === 'instructor'
        ? ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor']
        : ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    },
    launch_presentation: {
      return_url: '/dashboard',
      locale: 'en',
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /lms/lti/grades
 * Returns a mock grade passback response.
 */
export async function mockGradePassback(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, score, activity_id } = req.body;

  logger.info({ user_id, activity_id, score }, 'Mock grade passback');

  res.json({
    status: 'success',
    scoreGiven: score ?? 0,
    scoreMaximum: 100,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    userId: user_id,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /lms/lti/roster
 * Returns a mock student roster.
 */
export async function mockRosterImport(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role } = req.user;
  const { course_id } = req.body;

  if (!course_id) {
    throw new AppError(400, 'course_id is required', 'validation');
  }

  // Return actual enrolled students as mock roster data
  const roster = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT u.user_id, u.name, u.email, ue.role, ue.enrolled_at
       FROM user_enrollments ue
       JOIN users u ON u.user_id = ue.user_id
       WHERE ue.course_id = $1
       ORDER BY u.name`,
      [course_id]
    );
    return result.rows;
  });

  res.json({
    source: 'lti_mock',
    course_id,
    members: roster.map(m => ({
      user_id: m.user_id,
      name: m.name,
      email: m.email,
      role: m.role,
      status: 'Active',
      enrolled_at: m.enrolled_at,
    })),
    synced_at: new Date().toISOString(),
  });
}
