import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAssignedReviews, getReceivedReviews, getWeekAssignments } from '../controllers/reviewController.js';

const router = Router();

router.use(authenticate as any);

router.get('/assigned-reviews', getAssignedReviews as any);
router.get('/received-reviews', getReceivedReviews as any);
router.get('/weeks/:weekId/assignments', getWeekAssignments as any);

export default router;
