import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import {
  createSession,
  getSessions,
  toggleSession,
  releaseScores,
  getMyTeam,
  submitPeerReviews,
  getPeerReviewDraft,
  upsertPeerReviewDraft,
  submitInstructorReview,
  duplicateSession,
  getTeamReviews,
  getSessionResults,
  getBiasAnalytics,
  getStudentScores,
  getAllStudentsForSession,
  exportCsv,
  createAppeal,
  getMyAppeals,
  getAppealsForInstructor,
  updateAppealByInstructor,
} from '../controllers/peerReviewController.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  createSessionSchema,
  toggleSessionSchema,
  releaseScoresSchema,
  submitPeerReviewsSchema,
  upsertPeerReviewDraftSchema,
  instructorSubmitReviewsSchema,
  createPeerReviewAppealSchema,
  updatePeerReviewAppealSchema,
} from '../schemas.js';

const router = Router();
router.use(h(authenticate));

// Both roles can see sessions
router.get('/sessions', h(getSessions));

// Student endpoints
router.get('/sessions/:sessionId/my-team', h(getMyTeam));
router.get('/sessions/:sessionId/draft', h(getPeerReviewDraft));
router.patch('/sessions/:sessionId/draft', validate(upsertPeerReviewDraftSchema), h(upsertPeerReviewDraft));
router.post('/sessions/:sessionId/submit', validate(submitPeerReviewsSchema), h(submitPeerReviews));
router.get('/sessions/:sessionId/team-reviews', h(getTeamReviews));
router.get('/sessions/:sessionId/student-scores', h(getStudentScores));
router.get('/appeals/mine', h(requireRole('student')), h(getMyAppeals));
router.post('/appeals', h(requireRole('student')), validate(createPeerReviewAppealSchema), h(createAppeal));

// Instructor-only endpoints
router.post('/sessions', h(requireRole('instructor')), validate(createSessionSchema), h(createSession));
router.post('/sessions/:sessionId/duplicate', h(requireRole('instructor')), h(duplicateSession));
router.patch('/sessions/:sessionId', h(requireRole('instructor')), validate(toggleSessionSchema), h(toggleSession));
router.patch('/sessions/:sessionId/release-scores', h(requireRole('instructor')), validate(releaseScoresSchema), h(releaseScores));
router.get('/sessions/:sessionId/results', h(requireRole('instructor')), h(getSessionResults));
router.get('/sessions/:sessionId/bias-analytics', h(requireRole('instructor')), h(getBiasAnalytics));
router.get('/sessions/:sessionId/all-students', h(requireRole('instructor')), h(getAllStudentsForSession));
router.post('/sessions/:sessionId/instructor-review', h(requireRole('instructor')), validate(instructorSubmitReviewsSchema), h(submitInstructorReview));
router.get('/sessions/:sessionId/export-csv', h(requireRole('instructor')), h(exportCsv));
router.get('/appeals', h(requireRole('instructor')), h(getAppealsForInstructor));
router.patch('/appeals/:appealId', h(requireRole('instructor')), validate(updatePeerReviewAppealSchema), h(updateAppealByInstructor));

export default router;
