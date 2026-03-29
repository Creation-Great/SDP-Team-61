import { Router } from 'express';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate, validateParams } from '../middleware/validate.js';
import { createAssignmentTemplateSchema, uuidParamSchema } from '../schemas.js';
import {
  listAssignmentTemplates,
  createAssignmentTemplate,
  updateAssignmentTemplate,
} from '../controllers/assignmentTemplateController.js';

const router = Router();
router.use(h(authenticate));

router.get('/', h(listAssignmentTemplates));
router.post('/', h(requireRole('instructor')), validate(createAssignmentTemplateSchema), h(createAssignmentTemplate));
router.patch('/:id', validateParams(uuidParamSchema), h(requireRole('instructor')), validate(createAssignmentTemplateSchema), h(updateAssignmentTemplate));

export default router;
