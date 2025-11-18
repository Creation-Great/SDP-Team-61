import { Router } from 'express';
import { withDb, pool } from '../db';
import { audit } from '../utils/audit';
import asyncHandler from 'express-async-handler';
import { getBiasDetectionService } from '../services/biasDetection';

const router = Router();

/**
 * POST /reviews - Create a new review
 * Includes AI-powered bias detection and rewrite suggestions
 * Owner: Yanxiao Zheng (AI Integration)
 */
router.post('/', asyncHandler(async (req, res) => {
  const { user_id, role, course_id } = (req as any).user;
  const { submission_id, score, raw_uri, masked_uri, comment_text } = req.body || {};

  // Check if bias detection is enabled
  const biasDetectionEnabled = process.env.AI_BIAS_DETECTION_ENABLED !== 'false';
  const rewriteSuggestionsEnabled = process.env.AI_REWRITE_SUGGESTIONS_ENABLED !== 'false';
  
  let biasAnalysis = null;
  let rewriteSuggestion = null;

  // Run AI analysis if comment text provided and enabled
  if (comment_text && biasDetectionEnabled) {
    try {
      const biasService = getBiasDetectionService();
      biasAnalysis = await biasService.analyzeComment(comment_text, {
        courseId: course_id,
        submissionId: submission_id,
        reviewerId: user_id
      });

      // Generate rewrite suggestion if high risk detected
      if (rewriteSuggestionsEnabled && biasAnalysis.hasHighRisk && biasAnalysis.riskSegments.length > 0) {
        rewriteSuggestion = await biasService.generateRewriteSuggestion(
          comment_text,
          biasAnalysis.riskSegments
        );
      }
    } catch (error) {
      console.error('AI analysis failed, continuing without it:', error);
      // Don't block review submission if AI fails
    }
  }

  const result = await withDb(user_id, role, async (client) => {
    // Insert review
    const r = await client.query(
      `INSERT INTO reviews (submission_id, reviewer_id, score, raw_uri, masked_uri)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING review_id, created_at`,
      [submission_id, user_id, score || null, raw_uri || null, masked_uri || null]
    );
    
    const reviewId = r.rows[0].review_id;

    // Update assignment status
    await client.query(
      `UPDATE assignments SET status='completed' WHERE submission_id=$1 AND reviewer_id=$2`, 
      [submission_id, user_id]
    );

    // Store ML outputs if analysis was performed
    if (biasAnalysis) {
      await client.query(
        `INSERT INTO ml_outputs (
          review_id, course_id, toxicity, politeness, sentiment,
          identity_spans, evidence_spans, model_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          reviewId,
          course_id,
          biasAnalysis.toxicityScore,
          biasAnalysis.politenessScore,
          biasAnalysis.sentimentScore,
          JSON.stringify(biasAnalysis.identityMentions),
          JSON.stringify(biasAnalysis.riskSegments),
          biasAnalysis.modelVersion
        ]
      );
    }

    // Store rewrite suggestion if generated
    if (rewriteSuggestion) {
      await client.query(
        `INSERT INTO rewrite_suggestions (
          review_id, course_id, revised_uri, edits, preserved, why, model_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          reviewId,
          course_id,
          null, // revised_uri (for now, we're storing text inline)
          JSON.stringify({
            original: comment_text,
            rewritten: rewriteSuggestion.rewrittenText,
            changes: rewriteSuggestion.changesApplied
          }),
          JSON.stringify({ comment_text }), // preserved original
          JSON.stringify({ explanation: rewriteSuggestion.explanation }),
          biasAnalysis?.modelVersion || 'unknown'
        ]
      );
    }

    // Create risk flags for high-severity issues
    if (biasAnalysis && biasAnalysis.riskSegments.length > 0) {
      for (const segment of biasAnalysis.riskSegments) {
        // Only flag medium and above severity
        if (['medium', 'high', 'critical'].includes(segment.severity)) {
          await client.query(
            `INSERT INTO risk_flags (
              course_id, review_id, flag_type, severity, score, 
              span_start, span_end, message, suggested_rewrite, model_version
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              course_id,
              reviewId,
              segment.riskType,
              segment.severity,
              biasAnalysis.toxicityScore,
              segment.start,
              segment.end,
              segment.explanation,
              rewriteSuggestion?.rewrittenText || null,
              biasAnalysis.modelVersion
            ]
          );
        }
      }
    }

    // Audit log
    await audit(client, user_id, 'REVIEW', 'review', reviewId, { 
      submission_id, 
      score,
      ai_analysis: biasAnalysis ? {
        toxicity: biasAnalysis.toxicityScore,
        politeness: biasAnalysis.politenessScore,
        risk_level: biasAnalysis.overallSeverity,
        flags_created: biasAnalysis.riskSegments.filter(s => 
          ['medium', 'high', 'critical'].includes(s.severity)
        ).length
      } : null
    });

    return {
      review_id: reviewId,
      created_at: r.rows[0].created_at,
      ai_analysis: biasAnalysis ? {
        toxicity_score: biasAnalysis.toxicityScore,
        politeness_score: biasAnalysis.politenessScore,
        sentiment_score: biasAnalysis.sentimentScore,
        overall_severity: biasAnalysis.overallSeverity,
        has_high_risk: biasAnalysis.hasHighRisk,
        risk_count: biasAnalysis.riskSegments.length,
        improvement_tips: biasAnalysis.improvementTips
      } : null,
      rewrite_suggestion: rewriteSuggestion ? {
        rewritten_text: rewriteSuggestion.rewrittenText,
        explanation: rewriteSuggestion.explanation,
        changes_applied: rewriteSuggestion.changesApplied
      } : null
    };
  });

  res.status(201).json(result);
}));

/**
 * GET /reviews/:id/risk-flags - Get risk flags for a specific review
 * Returns AI-detected bias and toxicity issues
 */
router.get('/:id/risk-flags', asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { id: reviewId } = req.params;

  const flags = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `SELECT 
        flag_id, flag_type, severity, score, span_start, span_end,
        message, suggested_rewrite, model_version, 
        reviewed_by, reviewed_at, resolution, created_at
       FROM risk_flags
       WHERE review_id = $1
       ORDER BY severity DESC, created_at ASC`,
      [reviewId]
    );
    return result.rows;
  });

  res.json({ review_id: reviewId, flags });
}));

/**
 * PATCH /reviews/:id/risk-flags/:flagId - Mark a risk flag as reviewed
 * Instructor/admin only
 */
router.patch('/:id/risk-flags/:flagId', asyncHandler(async (req, res) => {
  const { user_id, role } = (req as any).user;
  const { id: reviewId, flagId } = req.params;
  const { resolution } = req.body || {};

  if (role !== 'instructor' && role !== 'admin') {
    return res.status(403).json({ 
      error: 'forbidden', 
      detail: 'Only instructors can review risk flags' 
    });
  }

  const updated = await withDb(user_id, role, async (client) => {
    const result = await client.query(
      `UPDATE risk_flags
       SET reviewed_by = $1, reviewed_at = now(), resolution = $2
       WHERE flag_id = $3 AND review_id = $4
       RETURNING flag_id, resolution, reviewed_at`,
      [user_id, resolution || 'acknowledged', flagId, reviewId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Risk flag not found or unauthorized');
    }

    await audit(client, user_id, 'RESOLVE_RISK_FLAG', 'risk_flag', flagId, {
      review_id: reviewId,
      resolution: resolution || 'acknowledged'
    });

    return result.rows[0];
  });

  res.json(updated);
}));

export default router;
