import { Router } from 'express';
import { z } from 'zod';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { upsertRubricSchema } from '../schemas.js';
import { getRubric, upsertRubric } from '../controllers/rubricController.js';

const rubricQuerySchema = z.object({
  rubric_type: z.enum(['file_review', 'peer_technical', 'peer_interactions', 'peer_management']).optional(),
  course_id: z.string().optional(),
  session_id: z.string().uuid().optional(),
}).strict();

const router = Router();
router.use(h(authenticate));

router.get('/', validateQuery(rubricQuerySchema), h(getRubric));
router.post('/', h(requireRole('instructor')), validate(upsertRubricSchema), h(upsertRubric));

export default router;
