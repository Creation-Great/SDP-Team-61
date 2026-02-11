import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getReviewById,
  submitReview,
  getReviewsBySubmission,
} from '../controllers/reviewController.js';

const router = Router();

// All routes require authentication
router.use(authenticate as any);

// Get reviews for a specific submission
router.get('/by-submission/:submissionId', getReviewsBySubmission as any);

// Get a specific review/assignment details
router.get('/:id', getReviewById as any);

// Submit a review
router.post('/:id/submit', submitReview as any);

export default router;
