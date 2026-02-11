import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { upload } from '../middleware/upload.js';
import {
  uploadSubmission,
  getMySubmissions,
  getAllSubmissions,
  getMyReviewTasks,
} from '../controllers/submissionController.js';

const router = Router();

// All routes require authentication
router.use(authenticate as any);

// Student: upload a submission
router.post('/upload', upload.single('file'), uploadSubmission as any);

// Student: get my submissions
router.get('/mine', getMySubmissions as any);

// Instructor: get all submissions
router.get('/all', requireRole('instructor') as any, getAllSubmissions as any);

// Student: get my assigned review tasks
router.get('/reviews/my-tasks', getMyReviewTasks as any);

export default router;
