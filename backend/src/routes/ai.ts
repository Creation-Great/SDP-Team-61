import { Router } from 'express';
import { withDb, pool } from '../db';
import { requireRole } from '../middleware/roleGuard';
import asyncHandler from 'express-async-handler';

/**
 * AI Metrics & Analytics Router
 * Owner: Yanxiao Zheng (AI Integration)
 * 
 * Provides instructor and admin access to bias detection metrics,
 * course-level statistics, and fairness monitoring.
 */

const router = Router();

/**
 * GET /ai/metrics/course/:courseId - Get bias detection metrics for a course
 * Instructor/Admin only
 */
router.get('/metrics/course/:courseId', requireRole('instructor'), asyncHandler(async (req, res) => {
  const { user_id, role, course_id: userCourseId } = (req as any).user;
  const { courseId } = req.params;
  const { start_date, end_date, group_id } = req.query;

  // Validate course access (non-admin instructors can only access their own course)
  if (role !== 'admin' && userCourseId !== courseId) {
    return res.status(403).json({ 
      error: 'forbidden', 
      detail: 'Access denied: not authorized for this course' 
    });
  }

  // Build date range constraints
  const startDate = start_date 
    ? new Date(start_date as string) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
  const endDate = end_date ? new Date(end_date as string) : new Date();

  const metrics = await pool.query(
    `WITH course_reviews AS (
      SELECT r.review_id, r.created_at, u.group_id
      FROM reviews r
      JOIN submissions s ON s.submission_id = r.submission_id
      JOIN users u ON u.user_id = s.user_id
      WHERE u.course_id = $1
        AND r.created_at BETWEEN $2 AND $3
        AND ($4::text IS NULL OR u.group_id = $4)
    ),
    ml_stats AS (
      SELECT
        COUNT(DISTINCT cr.review_id) as analyzed_count,
        AVG(mo.toxicity) as avg_toxicity,
        AVG(mo.politeness) as avg_politeness,
        AVG(mo.sentiment::numeric) as avg_sentiment,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mo.toxicity) as median_toxicity,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mo.politeness) as median_politeness
      FROM course_reviews cr
      LEFT JOIN ml_outputs mo ON mo.review_id = cr.review_id
    ),
    risk_stats AS (
      SELECT
        COUNT(*) as total_flags,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_flags,
        COUNT(*) FILTER (WHERE severity = 'high') as high_flags,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium_flags,
        COUNT(*) FILTER (WHERE severity = 'low') as low_flags,
        COUNT(*) FILTER (WHERE resolution IS NOT NULL) as resolved_flags,
        COUNT(DISTINCT review_id) as flagged_reviews,
        jsonb_object_agg(
          flag_type, 
          COUNT(*)
        ) as flags_by_type
      FROM risk_flags
      WHERE course_id = $1
        AND created_at BETWEEN $2 AND $3
        AND ($4::text IS NULL OR course_id IN (
          SELECT DISTINCT u.course_id
          FROM users u
          WHERE u.course_id = $1 AND u.group_id = $4
        ))
    ),
    rewrite_stats AS (
      SELECT
        COUNT(*) as suggestions_generated,
        COUNT(*) FILTER (WHERE adopted = true) as suggestions_adopted,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE adopted = true) / NULLIF(COUNT(*), 0),
          2
        ) as adoption_rate_pct
      FROM rewrite_suggestions rs
      JOIN course_reviews cr ON cr.review_id = rs.review_id
    )
    SELECT
      (SELECT COUNT(*) FROM course_reviews) as total_reviews,
      ms.*,
      rs.*,
      rws.*
    FROM ml_stats ms, risk_stats rs, rewrite_stats rws
    `,
    [courseId, startDate, endDate, group_id || null]
  );

  const result = metrics.rows[0];

  // Calculate risk rate
  const totalReviews = parseInt(result.total_reviews) || 0;
  const flaggedReviews = parseInt(result.flagged_reviews) || 0;
  const riskRate = totalReviews > 0 
    ? Math.round((flaggedReviews / totalReviews) * 100 * 100) / 100 
    : 0;

  res.json({
    course_id: courseId,
    group_id: group_id || null,
    date_range: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    overview: {
      total_reviews: totalReviews,
      analyzed_reviews: parseInt(result.analyzed_count) || 0,
      flagged_reviews: flaggedReviews,
      risk_rate_pct: riskRate
    },
    toxicity_politeness: {
      avg_toxicity: parseFloat(result.avg_toxicity) || 0,
      avg_politeness: parseFloat(result.avg_politeness) || 0,
      avg_sentiment: parseFloat(result.avg_sentiment) || 0,
      median_toxicity: parseFloat(result.median_toxicity) || 0,
      median_politeness: parseFloat(result.median_politeness) || 0
    },
    risk_flags: {
      total: parseInt(result.total_flags) || 0,
      by_severity: {
        critical: parseInt(result.critical_flags) || 0,
        high: parseInt(result.high_flags) || 0,
        medium: parseInt(result.medium_flags) || 0,
        low: parseInt(result.low_flags) || 0
      },
      by_type: result.flags_by_type || {},
      resolved: parseInt(result.resolved_flags) || 0,
      resolution_rate_pct: result.total_flags > 0 
        ? Math.round((result.resolved_flags / result.total_flags) * 100 * 100) / 100 
        : 0
    },
    rewrite_suggestions: {
      generated: parseInt(result.suggestions_generated) || 0,
      adopted: parseInt(result.suggestions_adopted) || 0,
      adoption_rate_pct: parseFloat(result.adoption_rate_pct) || 0
    }
  });
}));

/**
 * GET /ai/metrics/reviewer/:reviewerId - Get bias metrics for a specific reviewer
 * Instructor/Admin only
 */
router.get('/metrics/reviewer/:reviewerId', requireRole('instructor'), asyncHandler(async (req, res) => {
  const { user_id, role, course_id: userCourseId } = (req as any).user;
  const { reviewerId } = req.params;

  // Verify reviewer belongs to accessible course
  const reviewerCheck = await pool.query(
    'SELECT course_id, netid FROM users WHERE user_id = $1',
    [reviewerId]
  );

  if (reviewerCheck.rows.length === 0) {
    return res.status(404).json({ error: 'not_found', detail: 'Reviewer not found' });
  }

  const reviewerCourse = reviewerCheck.rows[0].course_id;
  if (role !== 'admin' && userCourseId !== reviewerCourse) {
    return res.status(403).json({ 
      error: 'forbidden', 
      detail: 'Access denied: reviewer not in your course' 
    });
  }

  const metrics = await pool.query(
    `SELECT
      COUNT(r.review_id) as total_reviews,
      AVG(mo.toxicity) as avg_toxicity,
      AVG(mo.politeness) as avg_politeness,
      AVG(mo.sentiment::numeric) as avg_sentiment,
      COUNT(DISTINCT rf.flag_id) as total_flags,
      COUNT(DISTINCT rf.flag_id) FILTER (WHERE rf.severity IN ('high', 'critical')) as high_severity_flags,
      COUNT(DISTINCT rs.review_id) as rewrite_suggestions,
      COUNT(DISTINCT rs.review_id) FILTER (WHERE rs.adopted = true) as suggestions_adopted
    FROM reviews r
    LEFT JOIN ml_outputs mo ON mo.review_id = r.review_id
    LEFT JOIN risk_flags rf ON rf.review_id = r.review_id
    LEFT JOIN rewrite_suggestions rs ON rs.review_id = r.review_id
    WHERE r.reviewer_id = $1
    GROUP BY r.reviewer_id
    `,
    [reviewerId]
  );

  const result = metrics.rows[0] || {
    total_reviews: 0,
    avg_toxicity: 0,
    avg_politeness: 0,
    avg_sentiment: 0,
    total_flags: 0,
    high_severity_flags: 0,
    rewrite_suggestions: 0,
    suggestions_adopted: 0
  };

  const totalReviews = parseInt(result.total_reviews);
  const flagRate = totalReviews > 0 
    ? Math.round((result.total_flags / totalReviews) * 100 * 100) / 100 
    : 0;

  res.json({
    reviewer_id: reviewerId,
    reviewer_netid: reviewerCheck.rows[0].netid,
    course_id: reviewerCourse,
    statistics: {
      total_reviews: totalReviews,
      avg_toxicity: parseFloat(result.avg_toxicity) || 0,
      avg_politeness: parseFloat(result.avg_politeness) || 0,
      avg_sentiment: parseFloat(result.avg_sentiment) || 0,
      flag_rate_pct: flagRate,
      total_flags: parseInt(result.total_flags) || 0,
      high_severity_flags: parseInt(result.high_severity_flags) || 0,
      rewrite_suggestions: parseInt(result.rewrite_suggestions) || 0,
      suggestions_adopted: parseInt(result.suggestions_adopted) || 0
    }
  });
}));

/**
 * GET /ai/metrics/trends/:courseId - Get weekly trend data for course
 * Instructor/Admin only
 */
router.get('/metrics/trends/:courseId', requireRole('instructor'), asyncHandler(async (req, res) => {
  const { user_id, role, course_id: userCourseId } = (req as any).user;
  const { courseId } = req.params;
  const { weeks = '12' } = req.query;

  if (role !== 'admin' && userCourseId !== courseId) {
    return res.status(403).json({ 
      error: 'forbidden', 
      detail: 'Access denied: not authorized for this course' 
    });
  }

  const weeksCount = parseInt(weeks as string);
  const startDate = new Date(Date.now() - weeksCount * 7 * 24 * 60 * 60 * 1000);

  const trends = await pool.query(
    `SELECT
      date_trunc('week', r.created_at) as week,
      COUNT(r.review_id) as review_count,
      AVG(mo.toxicity) as avg_toxicity,
      AVG(mo.politeness) as avg_politeness,
      COUNT(DISTINCT rf.flag_id) as flag_count,
      COUNT(DISTINCT rf.flag_id) FILTER (WHERE rf.severity IN ('high', 'critical')) as high_severity_flags
    FROM reviews r
    JOIN submissions s ON s.submission_id = r.submission_id
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN ml_outputs mo ON mo.review_id = r.review_id
    LEFT JOIN risk_flags rf ON rf.review_id = r.review_id
    WHERE u.course_id = $1
      AND r.created_at >= $2
    GROUP BY week
    ORDER BY week DESC
    `,
    [courseId, startDate]
  );

  res.json({
    course_id: courseId,
    weeks_requested: weeksCount,
    data_points: trends.rows.length,
    trends: trends.rows.map(row => ({
      week: row.week,
      review_count: parseInt(row.review_count),
      avg_toxicity: parseFloat(row.avg_toxicity) || 0,
      avg_politeness: parseFloat(row.avg_politeness) || 0,
      flag_count: parseInt(row.flag_count) || 0,
      high_severity_flags: parseInt(row.high_severity_flags) || 0
    }))
  });
}));

/**
 * GET /ai/risk-flags/unresolved/:courseId - Get all unresolved risk flags for a course
 * Instructor/Admin only
 */
router.get('/risk-flags/unresolved/:courseId', requireRole('instructor'), asyncHandler(async (req, res) => {
  const { user_id, role, course_id: userCourseId } = (req as any).user;
  const { courseId } = req.params;
  const { severity, limit = '50', offset = '0' } = req.query;

  if (role !== 'admin' && userCourseId !== courseId) {
    return res.status(403).json({ 
      error: 'forbidden', 
      detail: 'Access denied: not authorized for this course' 
    });
  }

  const severityFilter = severity ? 'AND rf.severity = $4' : '';
  const params = severity 
    ? [courseId, limit, offset, severity]
    : [courseId, limit, offset];

  const flags = await pool.query(
    `SELECT
      rf.flag_id,
      rf.review_id,
      rf.submission_id,
      rf.flag_type,
      rf.severity,
      rf.score,
      rf.message,
      rf.suggested_rewrite,
      rf.created_at,
      r.reviewer_id,
      ru.netid as reviewer_netid,
      s.submission_id,
      su.netid as submitter_netid
    FROM risk_flags rf
    LEFT JOIN reviews r ON r.review_id = rf.review_id
    LEFT JOIN users ru ON ru.user_id = r.reviewer_id
    LEFT JOIN submissions s ON s.submission_id = rf.submission_id
    LEFT JOIN users su ON su.user_id = s.user_id
    WHERE rf.course_id = $1
      AND rf.resolution IS NULL
      ${severityFilter}
    ORDER BY 
      CASE rf.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      rf.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    params
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) as total
     FROM risk_flags
     WHERE course_id = $1 AND resolution IS NULL ${severityFilter}`,
    severity ? [courseId, severity] : [courseId]
  );

  res.json({
    course_id: courseId,
    flags: flags.rows,
    pagination: {
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      has_more: parseInt(offset as string) + flags.rows.length < parseInt(countResult.rows[0].total)
    }
  });
}));

export default router;
