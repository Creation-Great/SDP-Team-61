import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAssignmentForm, submitAssignment } from '../controllers/reviewController.js';

const router = Router();

router.use(authenticate as any);

router.get('/:assignmentId/form', getAssignmentForm as any);
router.post('/:assignmentId/submit', submitAssignment as any);

export default router;
