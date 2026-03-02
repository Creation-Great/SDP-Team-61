import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { csvUpload } from '../middleware/csvUpload.js';
import {
  createCourse,
  listCourses,
  getCourseById,
  uploadDefinition,
  getCurrentDefinition,
  listDefinitions,
} from '../controllers/courseController.js';
import weekRoutes from './weekRoutes.js';

const router = Router();

router.use(authenticate as any);

router.post('/', createCourse as any);
router.get('/', listCourses as any);
router.get('/:courseId', getCourseById as any);
router.post('/:courseId/definition/upload', csvUpload.single('file'), uploadDefinition as any);
router.get('/:courseId/definition/current', getCurrentDefinition as any);
router.get('/:courseId/definitions', listDefinitions as any);

// Nested week routes
router.use('/:courseId/weeks', weekRoutes);

export default router;
