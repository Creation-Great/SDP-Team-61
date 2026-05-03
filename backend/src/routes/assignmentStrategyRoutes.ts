import { Router, Response } from 'express';
import { h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { assignmentStrategySchema, reviewExclusionSchema } from '../schemas.js';
import * as ctrl from '../controllers/assignmentStrategyController.js';
import type { AuthRequest } from '../types.js';

const router = Router();
router.use(h(authenticate));

router.patch('/strategy', h(requireRole('instructor', 'admin')), validate(assignmentStrategySchema), async (req, res: Response) => {
  await ctrl.updateStrategy(req as AuthRequest, res);
});

router.get('/exclusions', async (req, res: Response) => {
  await ctrl.getExclusions(req as AuthRequest, res);
});

router.post('/exclusions', h(requireRole('instructor', 'admin')), validate(reviewExclusionSchema), async (req, res: Response) => {
  await ctrl.addExclusion(req as AuthRequest, res);
});

router.delete('/exclusions/:id', h(requireRole('instructor', 'admin')), async (req, res: Response) => {
  await ctrl.removeExclusion(req as AuthRequest, res);
});

export default router;
