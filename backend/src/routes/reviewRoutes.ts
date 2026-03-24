import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getReviewById,
  submitReview,
  getReviewsBySubmission,
  getReviewDraft,
  upsertReviewDraft,
} from '../controllers/reviewController.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { submitReviewSchema, upsertReviewDraftSchema } from '../schemas.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

// Get reviews for a specific submission
router.get('/by-submission/:submissionId', h(getReviewsBySubmission));

// Get a specific review/assignment details
router.get('/:id', h(getReviewById));
router.get('/:id/draft', h(getReviewDraft));
router.patch('/:id/draft', validate(upsertReviewDraftSchema), h(upsertReviewDraft));

// Submit a review
router.post('/:id/submit', validate(submitReviewSchema), h(submitReview));

export default router;
