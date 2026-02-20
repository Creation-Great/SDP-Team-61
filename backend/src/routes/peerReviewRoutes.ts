import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import {
  createSession,
  getSessions,
  toggleSession,
  getMyTeam,
  submitPeerReviews,
  getTeamReviews,
  getSessionResults,
  exportCsv,
} from '../controllers/peerReviewController.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { createSessionSchema, toggleSessionSchema, submitPeerReviewsSchema } from '../schemas.js';

const router = Router();
router.use(h(authenticate));

// Both roles can see sessions
router.get('/sessions', h(getSessions));

// Student endpoints
router.get('/sessions/:sessionId/my-team', h(getMyTeam));
router.post('/sessions/:sessionId/submit', validate(submitPeerReviewsSchema), h(submitPeerReviews));
router.get('/sessions/:sessionId/team-reviews', h(getTeamReviews));

// Instructor-only endpoints
router.post('/sessions', h(requireRole('instructor')), validate(createSessionSchema), h(createSession));
router.patch('/sessions/:sessionId', h(requireRole('instructor')), validate(toggleSessionSchema), h(toggleSession));
router.get('/sessions/:sessionId/results', h(requireRole('instructor')), h(getSessionResults));
router.get('/sessions/:sessionId/export-csv', h(requireRole('instructor')), h(exportCsv));

export default router;
