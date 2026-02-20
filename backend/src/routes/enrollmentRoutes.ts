import { Router } from 'express';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import {
  listEnrollments,
  addEnrollment,
  updateEnrollment,
  removeEnrollment,
  listCourseMembers,
} from '../controllers/enrollmentController.js';

const router = Router();

// All endpoints require authentication
router.use(h(authenticate));

// Current user's enrollments (or ?user_id=xxx for instructor/admin)
router.get('/', h(listEnrollments));

// Add / upsert an enrollment
router.post('/', h(addEnrollment));

// Update group_id or is_primary on an existing enrollment
router.patch('/:enrollmentId', h(updateEnrollment));

// Remove an enrollment (instructor/admin only)
router.delete('/:enrollmentId', h(removeEnrollment));

// List all members of a course (instructor/admin only — enforced in controller)
router.get('/course/:courseId/members', h(listCourseMembers));

export default router;
