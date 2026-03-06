import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createWeek,
  listWeeks,
  getWeek,
  updateWeek,
  getWeekStatus,
  getWeekAnalytics,
  exportWeekCsv,
  getQualityFlags,
  getStudentReviews,
  streamWeekEvents,
} from '../controllers/weekController.js';

const router = Router({ mergeParams: true });

router.use(authenticate as any);

router.post('/', createWeek as any);
router.get('/', listWeeks as any);
router.patch('/:weekId', updateWeek as any);
router.get('/:weekId/status', getWeekStatus as any);
router.get('/:weekId/analytics', getWeekAnalytics as any);
router.get('/:weekId/export', exportWeekCsv as any);
router.get('/:weekId/quality-flags', getQualityFlags as any);
router.get('/:weekId/students/:weekStudentId/reviews', getStudentReviews as any);
router.get('/:weekId/events', streamWeekEvents as any);
router.get('/:weekId', getWeek as any);

export default router;
