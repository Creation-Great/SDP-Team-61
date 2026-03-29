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
import { validate, validateParams } from '../middleware/validate.js';
import {
  createSessionSchema,
  toggleSessionSchema,
  releaseScoresSchema,
  submitPeerReviewsSchema,
  upsertPeerReviewDraftSchema,
  instructorSubmitReviewsSchema,
  createPeerReviewAppealSchema,
  updatePeerReviewAppealSchema,
  sessionIdParamSchema,
  appealIdParamSchema,
} from '../schemas.js';

const router = Router();
router.use(h(authenticate));

// Both roles can see sessions
router.get('/sessions', h(getSessions));

// Student endpoints
router.get('/sessions/:sessionId/my-team', validateParams(sessionIdParamSchema), h(getMyTeam));
router.get('/sessions/:sessionId/draft', validateParams(sessionIdParamSchema), h(getPeerReviewDraft));
router.patch('/sessions/:sessionId/draft', validateParams(sessionIdParamSchema), validate(upsertPeerReviewDraftSchema), h(upsertPeerReviewDraft));
router.post('/sessions/:sessionId/submit', validateParams(sessionIdParamSchema), validate(submitPeerReviewsSchema), h(submitPeerReviews));
router.get('/sessions/:sessionId/team-reviews', validateParams(sessionIdParamSchema), h(getTeamReviews));
router.get('/sessions/:sessionId/student-scores', validateParams(sessionIdParamSchema), h(getStudentScores));
router.get('/appeals/mine', h(requireRole('student')), h(getMyAppeals));
router.post('/appeals', h(requireRole('student')), validate(createPeerReviewAppealSchema), h(createAppeal));

// Instructor-only endpoints
router.post('/sessions', h(requireRole('instructor')), validate(createSessionSchema), h(createSession));
router.post('/sessions/:sessionId/duplicate', validateParams(sessionIdParamSchema), h(requireRole('instructor')), h(duplicateSession));
router.patch('/sessions/:sessionId', validateParams(sessionIdParamSchema), h(requireRole('instructor')), validate(toggleSessionSchema), h(toggleSession));
router.patch('/sessions/:sessionId/release-scores', validateParams(sessionIdParamSchema), h(requireRole('instructor')), validate(releaseScoresSchema), h(releaseScores));
router.get('/sessions/:sessionId/results', validateParams(sessionIdParamSchema), h(requireRole('instructor')), h(getSessionResults));
router.get('/sessions/:sessionId/bias-analytics', validateParams(sessionIdParamSchema), h(requireRole('instructor')), h(getBiasAnalytics));
router.get('/sessions/:sessionId/all-students', validateParams(sessionIdParamSchema), h(requireRole('instructor')), h(getAllStudentsForSession));
router.post('/sessions/:sessionId/instructor-review', validateParams(sessionIdParamSchema), h(requireRole('instructor')), validate(instructorSubmitReviewsSchema), h(submitInstructorReview));
router.get('/sessions/:sessionId/export-csv', validateParams(sessionIdParamSchema), h(requireRole('instructor')), h(exportCsv));
router.get('/appeals', h(requireRole('instructor')), h(getAppealsForInstructor));
router.patch('/appeals/:appealId', validateParams(appealIdParamSchema), h(requireRole('instructor')), validate(updatePeerReviewAppealSchema), h(updateAppealByInstructor));

export default router;
