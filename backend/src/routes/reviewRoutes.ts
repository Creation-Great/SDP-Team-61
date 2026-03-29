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
import { validate, validateParams } from '../middleware/validate.js';
import { submitReviewSchema, upsertReviewDraftSchema, uuidParamSchema, submissionIdParamSchema } from '../schemas.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

// Get reviews for a specific submission
router.get('/by-submission/:submissionId', validateParams(submissionIdParamSchema), h(getReviewsBySubmission));

// Get a specific review/assignment details
router.get('/:id', validateParams(uuidParamSchema), h(getReviewById));
router.get('/:id/draft', validateParams(uuidParamSchema), h(getReviewDraft));
router.patch('/:id/draft', validateParams(uuidParamSchema), validate(upsertReviewDraftSchema), h(upsertReviewDraft));

// Submit a review
router.post('/:id/submit', validateParams(uuidParamSchema), validate(submitReviewSchema), h(submitReview));

export default router;
