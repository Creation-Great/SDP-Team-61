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

export default router;
