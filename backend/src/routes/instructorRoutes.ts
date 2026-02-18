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
} from '../controllers/instructorController.js';
import { csvUpload } from '../middleware/csvUpload.js';
import { getInstructorCheckinInsights } from '../controllers/checkinController.js';

const router = Router();

// All routes require authentication + instructor role
router.use(authenticate as any);
router.use(requireRole('instructor') as any);

router.get('/overview', getOverview as any);
router.post('/assign', assignReviewer as any);
router.post('/peer-review/aggregate', csvUpload.array('files', 30), aggregatePeerReviewCsv as any);
router.get('/checkins/current', getCurrentCheckins as any);
router.post('/checkins/current', saveCurrentCheckins as any);
router.get('/checkins/students', getCheckinStudents as any);
router.get('/checkins/insights', getInstructorCheckinInsights as any);

export default router;
