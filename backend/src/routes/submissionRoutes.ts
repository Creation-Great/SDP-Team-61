import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { upload, validateFileContent } from '../middleware/upload.js';
import {
  uploadSubmission,
  getMySubmissions,
  getAllSubmissions,
  getMyReviewTasks,
} from '../controllers/submissionController.js';
import { h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { uploadSubmissionSchema } from '../schemas.js';

const router = Router();

// All routes require authentication
router.use(h(authenticate));

// Student: upload a submission (multer → magic-byte check → schema → controller)
router.post('/upload', upload.single('file'), h(validateFileContent), validate(uploadSubmissionSchema), h(uploadSubmission));

// Student: get my submissions
router.get('/mine', h(getMySubmissions));

// Instructor: get all submissions
router.get('/all', h(requireRole('instructor')), h(getAllSubmissions));

// Student: get my assigned review tasks
router.get('/reviews/my-tasks', h(getMyReviewTasks));

export default router;
