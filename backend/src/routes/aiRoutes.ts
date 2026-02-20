import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  postFeedback,
  getFeedback,
  postRewrite,
  getRewrite,
  adoptRewrite,
} from '../controllers/aiController.js';
import { h } from '../utils/asyncHandler.js';

const router = Router();

// All AI routes require authentication
router.use(h(authenticate));

// Feedback analysis
router.post('/feedback', h(postFeedback));
router.get('/feedback/:reviewId', h(getFeedback));

// Rewrite suggestions
router.post('/rewrite', h(postRewrite));
router.get('/rewrite/:reviewId', h(getRewrite));
router.patch('/rewrite/:reviewId/adopt', h(adoptRewrite));

export default router;
