import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import {
  getOverview,
  assignReviewer,
  aggregatePeerReviewCsv,
  getCurrentCheckins,
  saveCurrentCheckins,
  getCheckinStudents,
  getUnifiedDashboard,
} from '../controllers/instructorController.js';
import { csvUpload } from '../middleware/csvUpload.js';
import { getInstructorCheckinInsights } from '../controllers/checkinController.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { assignReviewerSchema, saveCurrentCheckinsSchema } from '../schemas.js';

const router = Router();

// All routes require authentication + instructor role
router.use(h(authenticate));
router.use(h(requireRole('instructor')));

router.get('/overview', h(getOverview));
router.get('/unified-dashboard', h(getUnifiedDashboard));
router.post('/assign', validate(assignReviewerSchema), h(assignReviewer));
router.post('/peer-review/aggregate', csvUpload.array('files', 30), h(aggregatePeerReviewCsv));
router.get('/checkins/current', h(getCurrentCheckins));
router.post('/checkins/current', validate(saveCurrentCheckinsSchema), h(saveCurrentCheckins));
router.get('/checkins/students', h(getCheckinStudents));
router.get('/checkins/insights', h(getInstructorCheckinInsights));

export default router;
