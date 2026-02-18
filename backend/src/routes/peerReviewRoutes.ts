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

const router = Router();
router.use(authenticate as any);

// Both roles can see sessions
router.get('/sessions', getSessions as any);

// Student endpoints
router.get('/sessions/:sessionId/my-team', getMyTeam as any);
router.post('/sessions/:sessionId/submit', submitPeerReviews as any);
router.get('/sessions/:sessionId/team-reviews', getTeamReviews as any);

// Instructor-only endpoints
router.post('/sessions', requireRole('instructor') as any, createSession as any);
router.patch('/sessions/:sessionId', requireRole('instructor') as any, toggleSession as any);
router.get('/sessions/:sessionId/results', requireRole('instructor') as any, getSessionResults as any);
router.get('/sessions/:sessionId/export-csv', requireRole('instructor') as any, exportCsv as any);

export default router;
