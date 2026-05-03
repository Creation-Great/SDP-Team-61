import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { upload, validateFileContent } from '../middleware/upload.js';
import {
  uploadSubmission,
  getMySubmissions,
  getAllSubmissions,
  getMyReviewTasks,
  updateSubmission,
  replaceSubmissionFile,
  withdrawSubmission,
  getMyGradesSummary,
} from '../controllers/submissionController.js';
import { h } from '../utils/asyncHandler.js';
import { validate, validateParams } from '../middleware/validate.js';
import { uploadSubmissionSchema, updateSubmissionSchema, uuidParamSchema } from '../schemas.js';

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
router.get('/my-grades', h(requireRole('student')), h(getMyGradesSummary));

// Student: edit/withdraw own submission (before review exists)
router.patch('/:id', validateParams(uuidParamSchema), h(requireRole('student')), validate(updateSubmissionSchema), h(updateSubmission));
router.patch('/:id/replace-file', validateParams(uuidParamSchema), h(requireRole('student')), upload.single('file'), h(validateFileContent), h(replaceSubmissionFile));
router.delete('/:id', validateParams(uuidParamSchema), h(requireRole('student')), h(withdrawSubmission));

export default router;
