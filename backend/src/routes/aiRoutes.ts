import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams } from '../middleware/validate.js';
import {
  reviewIdParamSchema,
  aiFeedbackSchema,
  aiRewriteSchema,
  aiPolishSchema,
  aiSummarizeSchema,
} from '../schemas.js';
import {
  postFeedback,
  getFeedback,
  postRewrite,
  getRewrite,
  adoptRewrite,
  postPolish,
  postSummarize,
  getAiLogs,
  getSearch,
  postReviewDepth,
  postScoreSuggestion,
  postCalibration,
  postScoreReasoning,
  postSimilarity,
  postSimilarityTurnitin,
  postChat,
} from '../controllers/aiController.js';
import { h } from '../utils/asyncHandler.js';

const router = Router();

// All AI routes require authentication
router.use(h(authenticate));

// Feedback analysis
router.post('/feedback', validate(aiFeedbackSchema), h(postFeedback));
router.get('/feedback/:reviewId', validateParams(reviewIdParamSchema), h(getFeedback));

// Rewrite suggestions
router.post('/rewrite', validate(aiRewriteSchema), h(postRewrite));
router.get('/rewrite/:reviewId', validateParams(reviewIdParamSchema), h(getRewrite));
router.patch('/rewrite/:reviewId/adopt', validateParams(reviewIdParamSchema), h(adoptRewrite));

// Polish & Summarize
router.post('/polish', validate(aiPolishSchema), h(postPolish));
router.post('/summarize', validate(aiSummarizeSchema), h(postSummarize));

// AI activity logs
router.get('/logs', h(getAiLogs));

// Search
router.get('/search', h(getSearch));

// Review depth analysis
router.post('/review-depth', h(postReviewDepth));

// Score suggestion
router.post('/score-suggestion', h(postScoreSuggestion));

// Calibration
router.post('/calibration', h(postCalibration));

// Score reasoning
router.post('/score-reasoning', h(postScoreReasoning));

// Similarity detection
router.post('/similarity', h(postSimilarity));
router.post('/similarity/turnitin', h(postSimilarityTurnitin));

// Conversational AI chat
router.post('/chat', h(postChat));

export default router;
