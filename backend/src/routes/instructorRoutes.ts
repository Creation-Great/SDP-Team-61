import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import {
  getOverview,
  assignReviewer,
  bulkAssignReviewers,
  createAnnouncement,
  aggregatePeerReviewCsv,
  getCurrentCheckins,
  saveCurrentCheckins,
  getCheckinStudents,
  getUnifiedDashboard,
  getQualityFlags,
  getPeerReviewQualityFlags,
  exportFileReviewCsv,
  streamEvents,
  getSubmissionPolicy,
  upsertSubmissionPolicy,
} from '../controllers/instructorController.js';
import { csvUpload } from '../middleware/csvUpload.js';
import { getInstructorCheckinInsights } from '../controllers/checkinController.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { assignReviewerSchema, bulkAssignReviewersSchema, createAnnouncementSchema, saveCurrentCheckinsSchema, upsertSubmissionPolicySchema } from '../schemas.js';

const router = Router();

// All routes require authentication + instructor role
router.use(h(authenticate));
router.use(h(requireRole('instructor')));

router.get('/overview', h(getOverview));
router.get('/unified-dashboard', h(getUnifiedDashboard));
router.post('/assign', validate(assignReviewerSchema), h(assignReviewer));
router.post('/assign/bulk', validate(bulkAssignReviewersSchema), h(bulkAssignReviewers));
router.post('/announcements', validate(createAnnouncementSchema), h(createAnnouncement));
router.post('/peer-review/aggregate', csvUpload.array('files', 30), h(aggregatePeerReviewCsv));
router.get('/checkins/current', h(getCurrentCheckins));
router.post('/checkins/current', validate(saveCurrentCheckinsSchema), h(saveCurrentCheckins));
router.get('/checkins/students', h(getCheckinStudents));
router.get('/checkins/insights', h(getInstructorCheckinInsights));
router.get('/quality-flags', h(getQualityFlags));
router.get('/peer-review-quality-flags', h(getPeerReviewQualityFlags));
router.get('/export-csv', h(exportFileReviewCsv));
router.get('/events', h(streamEvents));
router.get('/submission-policy', h(getSubmissionPolicy));
router.put('/submission-policy', validate(upsertSubmissionPolicySchema), h(upsertSubmissionPolicy));

export default router;
