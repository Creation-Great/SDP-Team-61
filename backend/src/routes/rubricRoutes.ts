import { Router } from 'express';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { upsertRubricSchema } from '../schemas.js';
import { getRubric, upsertRubric } from '../controllers/rubricController.js';

const router = Router();
router.use(h(authenticate));

router.get('/', h(getRubric));
router.post('/', h(requireRole('instructor')), validate(upsertRubricSchema), h(upsertRubric));

export default router;
