import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getStudentCheckinContext, saveStudentSelfCheckins } from '../controllers/checkinController.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { saveStudentSelfCheckinsSchema } from '../schemas.js';

const router = Router();

router.use(h(authenticate));
router.use(h(requireRole('student')));

router.get('/context', h(getStudentCheckinContext));
router.post('/self', validate(saveStudentSelfCheckinsSchema), h(saveStudentSelfCheckins));

export default router;
