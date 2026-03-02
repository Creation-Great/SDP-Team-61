import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createWeek,
  listWeeks,
  getWeek,
  getWeekStatus,
  getWeekAnalytics,
  streamWeekEvents,
} from '../controllers/weekController.js';

const router = Router({ mergeParams: true });

router.use(authenticate as any);

router.post('/', createWeek as any);
router.get('/', listWeeks as any);
router.get('/:weekId/status', getWeekStatus as any);
router.get('/:weekId/analytics', getWeekAnalytics as any);
router.get('/:weekId/events', streamWeekEvents as any);
router.get('/:weekId', getWeek as any);

export default router;
