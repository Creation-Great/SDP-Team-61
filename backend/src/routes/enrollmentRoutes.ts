import { Router } from 'express';
import { z } from 'zod';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { validateParams } from '../middleware/validate.js';
import {
  listEnrollments,
  addEnrollment,
  updateEnrollment,
  removeEnrollment,
  listCourseMembers,
} from '../controllers/enrollmentController.js';

const enrollmentIdParamSchema = z.object({
  enrollmentId: z.string().uuid('enrollmentId must be a valid UUID'),
});

const courseIdParamSchema = z.object({
  courseId: z.string().min(1, 'courseId is required'),
});

const router = Router();

// All endpoints require authentication
router.use(h(authenticate));

// Current user's enrollments (or ?user_id=xxx for instructor/admin)
router.get('/', h(listEnrollments));

// Add / upsert an enrollment
router.post('/', h(addEnrollment));

// Update group_id or is_primary on an existing enrollment
router.patch('/:enrollmentId', validateParams(enrollmentIdParamSchema), h(updateEnrollment));

// Remove an enrollment (instructor/admin only)
router.delete('/:enrollmentId', validateParams(enrollmentIdParamSchema), h(removeEnrollment));

// List all members of a course (instructor/admin only — enforced in controller)
router.get('/course/:courseId/members', validateParams(courseIdParamSchema), h(listCourseMembers));

export default router;
