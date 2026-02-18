import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getStudentCheckinContext, saveStudentSelfCheckins } from '../controllers/checkinController.js';

const router = Router();

router.use(authenticate as any);
router.use(requireRole('student') as any);

router.get('/context', getStudentCheckinContext as any);
router.post('/self', saveStudentSelfCheckins as any);

export default router;
