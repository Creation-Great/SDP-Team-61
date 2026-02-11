import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getOverview, assignReviewer } from '../controllers/instructorController.js';

const router = Router();

// All routes require authentication + instructor role
router.use(authenticate as any);
router.use(requireRole('instructor') as any);

router.get('/overview', getOverview as any);
router.post('/assign', assignReviewer as any);

export default router;
